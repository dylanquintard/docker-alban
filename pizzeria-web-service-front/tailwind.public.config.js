const shared = require("./tailwind.shared");

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...shared,
  content: [
    "./index.html",
    "./src/main.jsx",
    "./src/App.js",
    "./src/components/**/*.{js,jsx,ts,tsx}",
    "./src/pages/{APropos,Blog,BlogArticle,CitySeoPage,ContactPage,Gallery,Home,LegalMentions,LocalSeoPage,Menu,NotFound,PrivacyPolicy,TermsPage,planing}.jsx",
  ],
};
