import bcrypt from "bcryptjs";
import { connectDb } from "./db";
import { config } from "./config";
import { User } from "./models/User";
import { Settings } from "./models/Settings";
import { Category } from "./models/Category";
import { MenuItem } from "./models/MenuItem";
import { rupeesToPaise } from "./utils/money";

async function seed() {
  await connectDb();

  const passwordHash = await bcrypt.hash(config.owner.password, 10);
  await User.findOneAndUpdate(
    { email: config.owner.email },
    {
      email: config.owner.email,
      passwordHash,
      name: config.owner.name,
      role: "owner",
    },
    { upsert: true, new: true }
  );

  await Settings.findOneAndUpdate(
    {},
    {
      $setOnInsert: {
        name: "Saffron Kitchen",
        intro:
          "Welcome to Saffron Kitchen. Scan, order, pay here, then collect when we ping you.",
        timezone: "Asia/Kolkata",
        dayStartHour: 6,
        whatsappDisplayNumber: config.whatsapp.displayNumber || "",
      },
    },
    { upsert: true }
  );

  const existing = await Category.countDocuments();
  if (existing === 0) {
    const menu: {
      name: string;
      items: { name: string; price: number; description: string }[];
    }[] = [
      {
        name: "Starters",
        items: [
          { name: "Paneer Tikka", price: 220, description: "Tandoor, mint chutney" },
          { name: "Chicken Tikka", price: 260, description: "Yogurt marinade" },
          { name: "Veg Spring Roll", price: 160, description: "Crispy, 4 pieces" },
          { name: "Hara Bhara Kebab", price: 180, description: "Spinach and peas" },
        ],
      },
      {
        name: "Mains",
        items: [
          { name: "Butter Chicken", price: 320, description: "Cream tomato gravy" },
          { name: "Paneer Butter Masala", price: 280, description: "House favourite" },
          { name: "Dal Tadka", price: 180, description: "Yellow dal, ghee tadka" },
          { name: "Veg Biryani", price: 240, description: "Dum cooked" },
          { name: "Chicken Biryani", price: 280, description: "Hyderabadi style" },
        ],
      },
      {
        name: "Breads",
        items: [
          { name: "Butter Naan", price: 50, description: "Tandoor" },
          { name: "Garlic Naan", price: 60, description: "Fresh garlic" },
          { name: "Tandoori Roti", price: 30, description: "Whole wheat" },
          { name: "Laccha Paratha", price: 55, description: "Layered" },
        ],
      },
      {
        name: "Beverages",
        items: [
          { name: "Masala Chai", price: 40, description: "Kettle brew" },
          { name: "Sweet Lassi", price: 80, description: "Homemade" },
          { name: "Fresh Lime Soda", price: 70, description: "Sweet or salted" },
          { name: "Water Bottle", price: 20, description: "500 ml" },
        ],
      },
      {
        name: "Desserts",
        items: [
          { name: "Gulab Jamun", price: 90, description: "2 pieces" },
          { name: "Kheer", price: 100, description: "Cardamom rice pudding" },
        ],
      },
    ];

    for (let i = 0; i < menu.length; i++) {
      const cat = await Category.create({
        name: menu[i].name,
        sortOrder: i,
        isActive: true,
      });
      for (let j = 0; j < menu[i].items.length; j++) {
        const it = menu[i].items[j];
        await MenuItem.create({
          categoryId: cat.id,
          name: it.name,
          description: it.description,
          pricePaise: rupeesToPaise(it.price),
          isAvailable: true,
          sortOrder: j,
        });
      }
    }
    console.log("Seeded sample menu");
  } else {
    console.log("Menu already present, skipped");
  }

  console.log(`Owner login: ${config.owner.email} / ${config.owner.password}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
