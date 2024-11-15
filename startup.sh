#!/bin/bash
# save as stop-bot.sh

# Get directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Kill the bot process
if [ -f "$DIR/bot.pid" ]; then
    pid=$(cat "$DIR/bot.pid")
    if ps -p $pid > /dev/null; then
        kill $pid
        rm "$DIR/bot.pid"
        echo "Bot stopped"
    else
        echo "Bot not running"
        rm "$DIR/bot.pid"
    fi
else
    pkill -f "node bot.js"
    echo "Bot stopped (no pid file found)"
fi
