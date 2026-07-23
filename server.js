const dotenv = require("dotenv");
const mongoose = require("mongoose");
dotenv.config({ path: "./.env" });

const app = require("./src/app");

const DB = process.env.DATABASE.replace(
  "<db_password>",
  encodeURIComponent(process.env.DATABASE_PASS),
);
mongoose.connect(DB).then((con) => {
  console.log("Database Connected Sucessfully");
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server startted running at port ${port}`);
});
