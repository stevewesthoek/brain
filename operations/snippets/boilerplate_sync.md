# Boilerplate Sync

Run these commands inside the actual boilerplate repo you want to sync.

## ProKit

```bash
cd /absolute/path/to/prokit
```

# 1) Work as normal
git status
# edit files...
git add .
git commit -m "Your message"

# 2) Push code to both org + personal demo:
git pushall

# 3) If you created or moved tags (new release):
git pushallt

## SaaSKit

```bash
cd /absolute/path/to/saaskit
```

git status
git add .
git commit -m "Your message"

git pushall      # main to both remotes
git pushallt     # tags to both remotes (when relevant)
