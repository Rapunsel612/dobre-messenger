import eel
import asyncio
import threading
import discord
import os
import json

# --- Make script location-proof ---
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# --- Configure Eel ---
eel.init('web')

# --- Config Storage in %localappdata% ---
APPDATA_PATH = os.getenv('LOCALAPPDATA')
DATA_FOLDER = os.path.join(APPDATA_PATH, 'dobre_messenger')
if not os.path.exists(DATA_FOLDER):
    os.makedirs(DATA_FOLDER)
CONFIG_PATH = os.path.join(DATA_FOLDER, "config.json")

def load_config():
    default = {"token": "", "channels": "", "interval": 10, "message": ""}
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r") as f:
                return json.load(f)
        except:
            return default
    return default

def save_config(token, channels, interval, message):
    try:
        with open(CONFIG_PATH, "w") as f:
            json.dump({
                "token": token,
                "channels": channels,
                "interval": interval,
                "message": message
            }, f, indent=4)
    except:
        pass

# --- Global state ---
bot_client = None
bot_thread = None
is_running = False
loop = None

# --- Discord Bot Logic ---
class TradingBot(discord.Client):
    def __init__(self, channel_ids, interval, message, log_callback):
        super().__init__()
        self.channel_ids = channel_ids
        self.interval = interval
        self.message = message
        self.log = log_callback

    async def on_ready(self):
        self.log(f"✅ Logged in as {self.user}")
        self.loop.create_task(self.send_periodically())

    async def send_periodically(self):
        await self.wait_until_ready()
        while not self.is_closed():
            for cid in self.channel_ids:
                channel = self.get_channel(cid)
                if channel is None:
                    self.log(f"⚠️ Channel {cid} not found")
                    continue
                try:
                    await channel.send(self.message)
                    self.log(f"📤 Sent to #{channel.name}")
                except discord.Forbidden:
                    self.log(f"🚫 No permission in #{channel.name}")
                except Exception as e:
                    self.log(f"❌ Error in {cid}: {e}")
                await asyncio.sleep(2)
            self.log(f"⏳ Waiting {self.interval}s...")
            await asyncio.sleep(self.interval)

# --- Eel exposed functions ---
@eel.expose
def start_bot(token, channel_ids_str, interval_str, message):
    global bot_client, bot_thread, is_running, loop

    if is_running:
        eel.log_push("⚠️ Bot already running")
        return

    token = token.strip()
    if not token:
        eel.log_push("❌ Token is required")
        return

    try:
        channel_ids = [int(x.strip()) for x in channel_ids_str.split(',') if x.strip()]
        if not channel_ids:
            eel.log_push("❌ At least one channel ID required")
            return
    except ValueError:
        eel.log_push("❌ Channel IDs must be numbers separated by commas")
        return

    try:
        interval = int(interval_str)
        if interval < 1:
            eel.log_push("❌ Interval must be at least 1 second")
            return
    except ValueError:
        eel.log_push("❌ Interval must be a number")
        return

    if not message.strip():
        eel.log_push("❌ Message cannot be empty")
        return

    is_running = True
    eel.log_push("🚀 Starting bot...")

    def run_async():
        global loop, bot_client
        new_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(new_loop)
        loop = new_loop

        client = TradingBot(channel_ids, interval, message, eel.log_push)
        bot_client = client
        try:
            new_loop.run_until_complete(client.start(token))
        except discord.LoginFailure:
            eel.log_push("❌ Invalid token – check your credentials")
        except Exception as e:
            eel.log_push(f"❌ Bot crashed: {e}")
        finally:
            eel.log_push("⏹ Bot stopped")
            eel.update_buttons("stopped")

    bot_thread = threading.Thread(target=run_async, daemon=True)
    bot_thread.start()
    eel.update_buttons("running")

@eel.expose
def stop_bot():
    global is_running, bot_client
    if not is_running:
        eel.log_push("⚠️ Bot not running")
        return
    is_running = False
    eel.log_push("⏳ Shutting down...")
    if bot_client and not bot_client.is_closed():
        asyncio.run_coroutine_threadsafe(bot_client.close(), bot_client.loop)
    eel.update_buttons("stopped")

@eel.expose
def toggle_token_visibility(show):
    pass

# ===== NEW EXPOSED FUNCTIONS FOR CONFIG =====
@eel.expose
def get_config():
    return load_config()

@eel.expose
def save_config_frontend(token, channels, interval, message):
    save_config(token, channels, interval, message)

# ===========================================

if __name__ == "__main__":
    eel.start('index.html', size=(720, 820), port=8080, cmdline_args=['--disable-web-security'])
