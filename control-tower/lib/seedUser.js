require("dotenv").config({ path: "../.env.local" });

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const MONGO_URI = process.env.MONGODB_URI;

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: {
    type: String,
    enum: ["admin", "investigator", "viewer"],
    default: "viewer",
  },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.models.User || mongoose.model("User", UserSchema);

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("DB Connected");

    const existing = await User.findOne({
      email: "user@test.com",
    });

    if (existing) {
      console.log("User already exists");
      process.exit();
    }

    const hashedPassword = await bcrypt.hash("userPassword", 10);

    await User.create({
      name: "User name",
      email: "user@test.com",
      password: hashedPassword,
      role: "admin",
    });

    console.log("User created!");
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();