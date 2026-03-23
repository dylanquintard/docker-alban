/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        ember: "#b6401f",
        tomato: "#d94b1f",
        saffron: "#f4b731",
        crust: "#f2d6a2",
        stonefire: "#1f1712",
        charcoal: "#12100d",
      },
      fontFamily: {
        display: [
          "Impact",
          "'Arial Black'",
          "'Haettenschweiler'",
          "'Franklin Gothic Bold'",
          "sans-serif",
        ],
        body: [
          "'Segoe UI'",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "'Helvetica Neue'",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        fire: "0 10px 30px rgba(217, 75, 31, 0.25)",
        card: "0 8px 24px rgba(18, 16, 13, 0.12)",
      },
      backgroundImage: {
        "oven-glow":
          "radial-gradient(circle at 50% 30%, rgba(255,190,70,0.36), rgba(18,16,13,0.92) 58%)",
      },
    },
  },
  plugins: [],
};
