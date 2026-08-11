import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Korumalı / kişisel alanları dizine ekleme
      disallow: [
        "/dashboard",
        "/coach",
        "/workouts",
        "/exercises",
        "/anatomy",
        "/programs",
        "/nutrition",
        "/progress",
        "/admin",
        "/onboarding",
        "/auth",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
