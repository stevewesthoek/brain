---
type: task
title: "Kow Check Ing aanpassingen"
assigned_to: you
status: done
priority: 3
effort: large
source: clickup-import
imported: 2026-04-11
---
## What to Do
About niet te zien op de telefoon. Plaats in off canvas menu.\nWitte versie website footer tekst niet goed op 2 plaatsen\nWanneer klaar plaats onderstaande CSS weer terug\n\n/* Custom Styles to apply dimmed background to the specific footer content area */\n.cs-custom-content.cs-custom-content-footer-before {\n    position: relative; /* Essential: Makes this div a positioning context for absolute children */\n    overflow: hidden;   /* Ensures background image respects borders/rounded corners if any */\n    /* Set the background image directly on this div */\n    background-image: url('https://kowchecking.com/wp-content/uploads/2025/06/ChatGPT-Image-Jun-12-2025-03_45_38-PM.jpeg');\n    background-size: cover;      /* Make the image cover the entire area */\n    background-position: center; /* Center the image */\n    background-repeat: no-repeat; /* Prevent image repetition */\n}\n\n/* Create a dimming overlay using a pseudo-element on the same div */\n.cs-custom-content.cs-custom-content-footer-before::before {\n    content: '';\n    position: absolute;\n    top: 0;\n    left: 0;\n    width: 100%;\n    height: 100%;\n    background-color: rgba(0, 0, 0, 0.77); /* Black color with 60% opacity */\n    z-index: 1; /* Place the overlay directly above the background image */\n}\n\n/* Ensure all existing content within this div appears on top of the background and overlay */\n/* This targets direct children of the .cs-custom-content.cs-custom-content-footer-before */\n.cs-custom-content.cs-custom-content-footer-before > * {\n    position: relative; /* Required for z-index to work */\n    z-index: 2; /* Place content above the dimming overlay */\n}\n\n/* Styles for the green arrow square container */\n/* You will need to place the HTML for this SVG separately in an HTML field if it's not already part of your footer. */\n.green-arrow-square-container {\n    position: absolute; /* Position it relative to its nearest positioned ancestor */\n    bottom: 1rem;       /* 16px from the bottom */\n    right: 1rem;        /* 16px from the right */\n    z-index: 20;        /* Ensure it's on top of all other footer elements */\n    /* You might need to adjust bottom/right values based on your specific layout */\n}

## Notes
Imported from ClickUp list: Business Tasks
Original ClickUp status: complete
