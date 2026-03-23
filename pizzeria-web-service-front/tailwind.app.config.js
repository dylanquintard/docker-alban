const shared = require("./tailwind.shared");

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...shared,
  content: [
    "./index.html",
    "./src/main.jsx",
    "./src/App.js",
    "./src/components/**/*.{js,jsx,ts,tsx}",
    "./src/pages/{BlogAdmin,Dashboard,EditProduct,FaqAdmin,ForgotPassword,GalleryAdmin,Ingredients,Locations,Login,Order,OrderConfirmation,OrderList,PrintAdmin,Products,Profile,Register,ResetPassword,SiteInfoAdmin,TicketsAdmin,Timeslots,Users,UsersOrders,VerifyEmail}.jsx",
  ],
};
