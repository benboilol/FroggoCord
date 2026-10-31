const {initializeApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {onDocumentCreated} = require('firebase-functions/v2/firestore');
const {onCall, HttpsError} = require('firebase-functions/v2/https');

initializeApp();
const db = getFirestore();

// Rate limiting: track message counts per user per minute
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_MESSAGES = 30; // max messages per minute

exports.validateMessage = onDocumentCreated('messages/{messageId}', async (event) => {
  const snap = event.data;
  if (!snap) return;
  const data = snap.data();
  const uid = data.uid;
  const user = data.user;
  const text = data.text || '';

  // Validate text length
  if (text.length > 4000) {
    await snap.ref.delete();
    console.log(`Message deleted: text too long (${text.length} chars) by ${user}`);
    return;
  }

  // Validate required fields
  if (!data.channel || !data.user) {
    await snap.ref.delete();
    console.log(`Message deleted: missing required fields by ${user}`);
    return;
  }

  // Rate limiting
  if (uid) {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    const rateLimitRef = db.collection('rateLimits').doc(uid);

    try {
      const rateDoc = await rateLimitRef.get();
      let timestamps = [];

      if (rateDoc.exists) {
        timestamps = rateDoc.data().timestamps || [];
        // Filter to only recent timestamps
        timestamps = timestamps.filter(t => t > windowStart);
      }

      timestamps.push(now);

      if (timestamps.length > RATE_LIMIT_MAX_MESSAGES) {
        await snap.ref.delete();
        console.log(`Message deleted: rate limit exceeded by ${user} (${timestamps.length} messages in window)`);
        return;
      }

      await rateLimitRef.set({ timestamps, lastUpdated: FieldValue.serverTimestamp() }, { merge: true });
    } catch (e) {
      console.error('Rate limit check failed', e);
    }
  }

  // Award badges based on activity
  if (user) {
    try {
      const userRef = db.collection('users').doc(user);
      const userDoc = await userRef.get();
      const badges = userDoc.exists ? (userDoc.data().badges || []) : [];

      // First message badge
      if (!badges.includes('first-message')) {
        badges.push('first-message');
        await userRef.set({ badges }, { merge: true });
        console.log(`Badge awarded: first-message to ${user}`);
      }

      // Count messages for "active chatter" badge
      const msgCount = await db.collection('messages').where('user', '==', user).count().get();
      if (msgCount.data().count >= 100 && !badges.includes('active-chatter')) {
        badges.push('active-chatter');
        await userRef.set({ badges }, { merge: true });
        console.log(`Badge awarded: active-chatter to ${user}`);
      }
    } catch (e) {
      console.error('Badge award failed', e);
    }
  }
});

// Server creation badge award
exports.onServerCreated = onDocumentCreated('servers/{serverId}', async (event) => {
  const snap = event.data;
  if (!snap) return;
  const data = snap.data();
  const owner = data.owner;

  if (owner) {
    try {
      const userRef = db.collection('users').doc(owner);
      const userDoc = await userRef.get();
      const badges = userDoc.exists ? (userDoc.data().badges || []) : [];

      if (!badges.includes('server-creator')) {
        badges.push('server-creator');
        await userRef.set({ badges }, { merge: true });
        console.log(`Badge awarded: server-creator to ${owner}`);
      }
    } catch (e) {
      console.error('Server creator badge failed', e);
    }
  }
});

// Friend request badge award
exports.onFriendAccepted = onDocumentCreated('friends/{friendId}', async (event) => {
  const snap = event.data;
  if (!snap) return;
  const data = snap.data();

  if (data.status === 'accepted') {
    const from = data.from;
    const to = data.to;

    for (const username of [from, to]) {
      try {
        const userRef = db.collection('users').doc(username);
        const userDoc = await userRef.get();
        const badges = userDoc.exists ? (userDoc.data().badges || []) : [];

        // Count friends
        const friendsSnap = await db.collection('friends')
          .where('status', '==', 'accepted')
          .get();
        const friendCount = friendsSnap.docs.filter(d => d.data().from === username || d.data().to === username).length;

        if (friendCount >= 10 && !badges.includes('popular')) {
          badges.push('popular');
          await userRef.set({ badges }, { merge: true });
          console.log(`Badge awarded: popular to ${username}`);
        }
      } catch (e) {
        console.error('Friend badge award failed', e);
      }
    }
  }
});

// Callable function to check rate limit status
exports.checkRateLimit = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }
  const uid = request.auth.uid;
  const rateLimitRef = db.collection('rateLimits').doc(uid);
  const rateDoc = await rateLimitRef.get();

  if (!rateDoc.exists) {
    return { remaining: RATE_LIMIT_MAX_MESSAGES, resetIn: 0 };
  }

  const timestamps = rateDoc.data().timestamps || [];
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = timestamps.filter(t => t > windowStart);

  return {
    remaining: Math.max(0, RATE_LIMIT_MAX_MESSAGES - recent.length),
    resetIn: recent.length > 0 ? RATE_LIMIT_WINDOW_MS - (now - recent[0]) : 0
  };
});
