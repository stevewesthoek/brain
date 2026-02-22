ProKit
cd /Users/Office/Repos/Organisation/ProChat/Boilerplates/Products/prokit

# 1) Work as normal
git status
# edit files...
git add .
git commit -m "Your message"

# 2) Push code to both org + personal demo:
git pushall

# 3) If you created or moved tags (new release):
git pushallt

SaaSKit
cd /Users/Office/Repos/Organisation/ProChat/Boilerplates/Products/saaskit

git status
git add .
git commit -m "Your message"

git pushall      # main to both remotes
git pushallt     # tags to both remotes (when relevant)