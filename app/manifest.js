// "Add to Home Screen": opens full-screen with its own icon, like an app.
export default function manifest() {
  return {
    name: "Carter Finances",
    short_name: "Finances",
    description: "Public demo of a synthetic household finance dashboard",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f4f1",
    theme_color: "#f5f4f1",
    icons: [],
  };
}
