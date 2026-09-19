# Deployment

## Frontend

GitHub Pages serves the frontend at:

https://meg-app.isomeone.nl

Keep `CNAME` set to `meg-app.isomeone.nl`.

## Multiplayer backend

GitHub Pages cannot run `server.js`. Deploy this repository to Render using `render.yaml`.

Render provides a URL similar to:

https://backrooms-game-oz0r.onrender.com

Use that URL as the backend in the game:

https://meg-app.isomeone.nl/?server=https://backrooms-game-oz0r.onrender.com

Replace the example hostname with the exact URL shown by Render.

## Optional custom backend domain

Do not point `meg-app.isomeone.nl` to Render because that hostname belongs to GitHub Pages. Instead, create a separate DNS CNAME record at your DNS provider:

- Name: `multiplayer`
- Type: `CNAME`
- Target: `backrooms-game-oz0r.onrender.com`

After DNS propagates, use:

https://meg-app.isomeone.nl/?server=https://multiplayer.meg-app.isomeone.nl

In Render, add `multiplayer.meg-app.isomeone.nl` under the service's Custom Domains and complete Render's verification steps.

The DNS record is created at the domain provider, not in GitHub Pages and not by adding another line to the repository's `CNAME` file.
