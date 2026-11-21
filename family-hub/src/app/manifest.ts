import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Családi Hub",
    short_name: "Családi Hub",
    description: "Privát családi szervező",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f3ec",
    theme_color: "#c2553d",
    lang: "hu",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
