import { createApp } from "./app.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const { app } = createApp();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Incident dashboard server listening on http://localhost:${port}`);
});

