const shared = require("./tailwind.shared");

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...shared,
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./index.html"],
};
