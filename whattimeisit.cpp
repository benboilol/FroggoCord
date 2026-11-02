#include <iostream>
#include <iomanip>
#include <ctime>
#include <fstream>
#include <string>
int main(int argc,char* argv[]){
    if(argc!=2){
        std::cerr<<"Usage: "<<argv[0]<<" <id>\n"<<std::flush;
        return 1;
    }
    std::time_t time=std::time(nullptr);
    std::tm tm=*std::localtime(&time);
    std::string id=argv[1];
    std::ofstream changelogFile("changelog.md",std::ios::app);
    std::cout<<id<<"-"<<std::put_time(&tm,"%Y.%m.%d-%H.%M.%S%z")<<"\n"<<std::flush;
    changelogFile<<" - "<<id<<"-"<<std::put_time(&tm,"%Y.%m.%d-%H.%M.%S%z: ");
    changelogFile.close();
}
