# TOOLS.md - Server Notes (srv1302722)

## Pencil.dev
- AppImage: `/root/clawd/Pencil.AppImage`
- Extracted: `/root/clawd/squashfs-root/`
- Log: `/root/clawd/pencil.log`
- Start command: `DISPLAY=:99 /root/clawd/squashfs-root/pencil --no-sandbox &`
- MCP skill: `~/.clawdbot/skills/pencil/`

## Xvfb (Virtual Display)
- Display: `:99`
- Start: `Xvfb :99 -screen 0 1920x1080x24 &`

## Browserbase
- API Key: `bb_live_QSkjSgM4jBfKGT07F6UFnrXcXko`
- Project: `4572fea3-d93e-422e-bd16-2ebfa0c2b365`
- Helper: `/root/clawd/browserbase.js`

## Gateway
- Port: 18789
- Bind: LAN
- Token: `4c5712eb31f8a3e861b8605f4d46bee8ed9bd1a8f3fc9cb2`
