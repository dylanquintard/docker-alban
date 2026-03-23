const shared = require("../pizzeria-web-service-front/tailwind.shared");

module.exports = {
  ...shared,
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
    "../pizzeria-web-service-front/src/**/*.{js,jsx,ts,tsx}",
  ],
};
