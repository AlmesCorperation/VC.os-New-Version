#include <emscripten/emscripten.h>
#include <string>
#include <vector>

extern "C" {
    EMSCRIPTEN_KEEPALIVE
    const char* execute_nolona_command(const char* command) {
        std::string cmd = std::string(command);
        
        if (cmd == "list") {
            return "Instance List: [Running] nolona-1, [Stopped] nolona-2";
        } else if (cmd == "info") {
            return "Nolona Engine: v1.0.0 | Status: Operational";
        } else {
            return "Command not recognized by Nolona Engine";
        }
    }
}
