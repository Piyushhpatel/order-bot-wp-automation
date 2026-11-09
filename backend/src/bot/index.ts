import mongoose from "mongoose";
import { Category } from "../models/Category";
import { MenuItem } from "../models/MenuItem";
import { Order } from "../models/Order";
import {
  CartLine,
  SessionDoc,
  loadSession,
} from "../models/Session";
import { getSettings } from "../models/Settings";
import { sendButtons, sendCtaUrl, sendList, sendText } from "../services/whatsapp";
import { createPaymentLink } from "../services/payments";
import { cartTotalPaise, formatInr } from "../utils/money";
import { trunc } from "../utils/phone";
import { razorpayConfigured } from "../config";

export type ParsedInbound = {
  kind: "text" | "button" | "list";
  id?: string;
  text?: string;
};

const CAT_PAGE = 9;
const ITEM_PAGE = 8;

export async function handleIncoming(
  waPhone: string,
  msg: ParsedInbound
): Promise<void> {
  const session = await loadSession(waPhone);
  const action = (msg.id || "").trim();
  const text = (msg.text || "").trim();
  const command = action || textCommand(text);

  if (session.state === "checkout_table" && msg.kind === "text") {
    await handleTableNumber(session, text);
    return;
  }
  if (session.state === "checkout_name" && msg.kind === "text") {
    await handleName(session, text);
    return;
  }

  if (command === "MENU") {
    await showCategories(session, 0);
    return;
  }
  if (command === "CART" || command === "nav:cart") {
    await showCart(session);
    return;
  }
  if (command === "HELP") {
    await showHelp(session);
    return;
  }
  if (command === "NEW_ORDER") {
    session.cart = [];
    session.checkout = {};
    session.selectedItemId = undefined;
    await showWelcome(session);
    return;
  }
  if (command === "CANCEL") {
    await handleCancel(session);
    return;
  }
  if (command === "PAY_AGAIN") {
    await payAgain(session);
    return;
  }

  if (action.startsWith("cat:")) {
    await showItems(session, action.slice(4), 0);
    return;
  }
  if (action.startsWith("nav:cats:")) {
    await showCategories(session, Number(action.split(":")[2]) || 0);
    return;
  }
  if (action.startsWith("nav:items:")) {
    const [, , categoryId, page] = action.split(":");
    await showItems(session, categoryId, Number(page) || 0);
    return;
  }
  if (action.startsWith("item:")) {
    await showItem(session, action.slice(5));
    return;
  }
  if (action.startsWith("qty:")) {
    await addToCart(session, Number(action.slice(4)) || 1);
    return;
  }
  if (action.startsWith("line:")) {
    await showEditLine(session, action.slice(5));
    return;
  }

  switch (command) {
    case "ADD_1":
      await addToCart(session, 1);
      return;
    case "CHOOSE_QTY":
      await showQtyPicker(session);
      return;
    case "BACK":
      await handleBack(session);
      return;
    case "PLACE_ORDER":
      await startCheckout(session);
      return;
    case "ADD_MORE":
      await showCategories(session, 0);
      return;
    case "EDIT_CART":
      await showEditCart(session);
      return;
    case "INC":
      await changeLineQty(session, 1);
      return;
    case "DEC":
      await changeLineQty(session, -1);
      return;
    case "REMOVE":
      await removeLine(session);
      return;
    case "DINE_IN":
      session.checkout = { ...session.checkout, fulfillment: "dine_in" };
      session.state = "checkout_table";
      await session.save();
      await sendText(
        session.waPhone,
        "What is your table number? Reply with a number (for example 7)."
      );
      return;
    case "PARCEL":
      session.checkout = {
        ...session.checkout,
        fulfillment: "parcel",
        tableNumber: undefined,
      };
      session.state = "checkout_name";
      await session.save();
      await sendText(session.waPhone, "What name should we put on the order?");
      return;
    case "PAY_NOW":
      await placeAndPay(session);
      return;
    default:
      break;
  }

  if (session.state === "welcome" || msg.kind === "text") {
    await showWelcome(session);
    return;
  }

  await sendText(
    session.waPhone,
    "Please use the buttons below the last message, or tap Menu."
  );
}

function textCommand(text: string): string {
  const t = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t === "menu") return "MENU";
  if (["cart", "my cart", "view cart"].includes(t)) return "CART";
  if (["help"].includes(t)) return "HELP";
  return "";
}

async function showWelcome(session: SessionDoc): Promise<void> {
  const settings = await getSettings();
  session.state = "welcome";
  await session.save();
  await sendButtons(
    session.waPhone,
    `*${settings.name}*\n\n${settings.intro}`,
    [
      { id: "MENU", title: "Menu" },
      { id: "CART", title: "My Cart" },
      { id: "HELP", title: "Help" },
    ]
  );
}

async function showHelp(session: SessionDoc): Promise<void> {
  await sendButtons(
    session.waPhone,
    [
      "How to order:",
      "1. Tap Menu, pick a category, then an item.",
      "2. Add quantity to your cart.",
      "3. Place order, choose Parcel or Dine in, pay.",
      "4. You get a token number. We message you when it is ready.",
    ].join("\n"),
    [
      { id: "MENU", title: "Menu" },
      { id: "CART", title: "My Cart" },
      { id: "HELP", title: "Help" },
    ]
  );
}

async function showCategories(session: SessionDoc, page: number): Promise<void> {
  const cats = await Category.find({ isActive: true }).sort({
    sortOrder: 1,
    name: 1,
  });
  if (!cats.length) {
    await sendText(
      session.waPhone,
      "The menu is empty right now. Please ask the staff."
    );
    return;
  }

  const p = Math.max(0, page);
  const slice = cats.slice(p * CAT_PAGE, p * CAT_PAGE + CAT_PAGE);
  const hasMore = cats.length > (p + 1) * CAT_PAGE;

  const rows = slice.map((c) => ({
    id: `cat:${c.id}`,
    title: trunc(c.name, 24),
    description: "Open category",
  }));

  if (hasMore) {
    rows.push({
      id: `nav:cats:${p + 1}`,
      title: "More categories",
      description: "Next page",
    });
  } else if (p > 0) {
    rows.push({
      id: "nav:cats:0",
      title: "Back to start",
      description: "First page",
    });
  } else if (rows.length < 10) {
    rows.push({
      id: "nav:cart",
      title: "View cart",
      description: cartHint(session),
    });
  }

  session.state = "browsing_categories";
  session.page = p;
  await session.save();

  await sendList(
    session.waPhone,
    "Pick a category to see items.",
    "Categories",
    [{ title: "Menu", rows: rows.slice(0, 10) }],
    { header: "Menu" }
  );
}

async function showItems(
  session: SessionDoc,
  categoryId: string,
  page: number
): Promise<void> {
  if (!mongoose.isValidObjectId(categoryId)) {
    await showCategories(session, 0);
    return;
  }
  const category = await Category.findOne({
    _id: categoryId,
    isActive: true,
  });
  if (!category) {
    await sendText(session.waPhone, "That category is not available.");
    await showCategories(session, 0);
    return;
  }

  const items = await MenuItem.find({
    categoryId,
    isAvailable: true,
  }).sort({ sortOrder: 1, name: 1 });

  if (!items.length) {
    session.state = "browsing_categories";
    await session.save();
    await sendButtons(
      session.waPhone,
      `${category.name} has no items right now.`,
      [
        { id: "MENU", title: "Menu" },
        { id: "CART", title: "My Cart" },
        { id: "HELP", title: "Help" },
      ]
    );
    return;
  }

  const p = Math.max(0, page);
  const slice = items.slice(p * ITEM_PAGE, p * ITEM_PAGE + ITEM_PAGE);
  const hasMore = items.length > (p + 1) * ITEM_PAGE;

  const rows = slice.map((item) => ({
    id: `item:${item.id}`,
    title: trunc(item.name, 24),
    description: `${formatInr(item.pricePaise)} · tap to add`,
  }));

  if (hasMore) {
    rows.push({
      id: `nav:items:${categoryId}:${p + 1}`,
      title: "View more",
      description: "Next items",
    });
  }
  if (rows.length < 10) {
    rows.push({
      id: "MENU",
      title: "Back to menu",
      description: "All categories",
    });
  }

  session.state = "browsing_items";
  session.categoryId = categoryId;
  session.page = p;
  await session.save();

  await sendList(
    session.waPhone,
    `*${category.name}*\nPick an item.`,
    "Items",
    [{ title: trunc(category.name, 24), rows: rows.slice(0, 10) }]
  );
}

async function showItem(session: SessionDoc, itemId: string): Promise<void> {
  const item = await findAvailableItem(itemId);
  if (!item) {
    await sendText(session.waPhone, "That item is not available.");
    if (session.categoryId) await showItems(session, session.categoryId, 0);
    else await showCategories(session, 0);
    return;
  }
  session.selectedItemId = item.id;
  session.state = "item_detail";
  await session.save();

  const desc = item.description ? `\n${item.description}` : "";
  await sendButtons(
    session.waPhone,
    `*${item.name}*\n${formatInr(item.pricePaise)}${desc}`,
    [
      { id: "ADD_1", title: "Add 1" },
      { id: "CHOOSE_QTY", title: "Choose qty" },
      { id: "BACK", title: "Back" },
    ]
  );
}

async function showQtyPicker(session: SessionDoc): Promise<void> {
  if (!session.selectedItemId) {
    await showCategories(session, 0);
    return;
  }
  session.state = "choosing_qty";
  await session.save();
  const rows = Array.from({ length: 9 }, (_, i) => ({
    id: `qty:${i + 1}`,
    title: String(i + 1),
    description: i === 0 ? "Add one" : `Add ${i + 1}`,
  }));
  rows.push({ id: "BACK", title: "Back", description: "Cancel" });
  await sendList(session.waPhone, "How many would you like?", "Quantity", [
    { title: "Quantity", rows },
  ]);
}

async function addToCart(session: SessionDoc, qty: number): Promise<void> {
  const n = Math.max(1, Math.min(20, Math.floor(qty)));
  if (!session.selectedItemId) {
    await showCart(session);
    return;
  }
  const item = await findAvailableItem(session.selectedItemId);
  if (!item) {
    await sendText(session.waPhone, "That item is no longer available.");
    await showCategories(session, 0);
    return;
  }
  const existing = session.cart.find((l) => l.itemId === item.id);
  if (existing) existing.qty += n;
  else {
    session.cart.push({
      itemId: item.id,
      name: item.name,
      pricePaise: item.pricePaise,
      qty: n,
    });
  }
  session.markModified("cart");
  await showCart(session);
}

async function showCart(session: SessionDoc): Promise<void> {
  if (!session.cart.length) {
    session.state = "cart";
    await session.save();
    await sendButtons(session.waPhone, "Your cart is empty.", [
      { id: "MENU", title: "Menu" },
      { id: "HELP", title: "Help" },
    ]);
    return;
  }
  session.state = "cart";
  await session.save();
  await sendButtons(session.waPhone, renderCart(session.cart), [
    { id: "PLACE_ORDER", title: "Place order" },
    { id: "ADD_MORE", title: "Add more" },
    { id: "EDIT_CART", title: "Edit cart" },
  ]);
}

function renderCart(cart: CartLine[]): string {
  const lines = cart
    .map((l) => `• ${l.name} × ${l.qty} — ${formatInr(l.pricePaise * l.qty)}`)
    .join("\n");
  return `*Your cart*\n\n${lines}\n\n*Total ${formatInr(cartTotalPaise(cart))}*`;
}

function cartHint(session: SessionDoc): string {
  if (!session.cart.length) return "Empty";
  const n = session.cart.reduce((s, l) => s + l.qty, 0);
  return `${n} item${n === 1 ? "" : "s"} · ${formatInr(cartTotalPaise(session.cart))}`;
}

async function showEditCart(session: SessionDoc): Promise<void> {
  if (!session.cart.length) {
    await showCart(session);
    return;
  }
  session.state = "editing_cart";
  await session.save();
  const rows = session.cart.slice(0, 9).map((l) => ({
    id: `line:${l.itemId}`,
    title: trunc(l.name, 24),
    description: `× ${l.qty} · ${formatInr(l.pricePaise * l.qty)}`,
  }));
  rows.push({ id: "CART", title: "Done", description: "Back to cart" });
  await sendList(session.waPhone, "Tap a line to change it.", "Edit cart", [
    { title: "Cart", rows: rows.slice(0, 10) },
  ]);
}

async function showEditLine(
  session: SessionDoc,
  itemId: string
): Promise<void> {
  const line = session.cart.find((l) => l.itemId === itemId);
  if (!line) {
    await showEditCart(session);
    return;
  }
  session.editingItemId = itemId;
  session.state = "editing_line";
  await session.save();
  await sendButtons(
    session.waPhone,
    `*${line.name}*\nQuantity ${line.qty} · ${formatInr(line.pricePaise * line.qty)}`,
    [
      { id: "INC", title: "+1" },
      { id: "DEC", title: "-1" },
      { id: "REMOVE", title: "Remove" },
    ]
  );
}

async function changeLineQty(
  session: SessionDoc,
  delta: number
): Promise<void> {
  const id = session.editingItemId;
  const line = session.cart.find((l) => l.itemId === id);
  if (!line) {
    await showCart(session);
    return;
  }
  line.qty += delta;
  if (line.qty <= 0) {
    session.cart = session.cart.filter((l) => l.itemId !== id);
  }
  session.markModified("cart");
  if (!session.cart.length) {
    session.editingItemId = undefined;
    await showCart(session);
    return;
  }
  await showEditLine(session, session.cart.find((l) => l.itemId === id)?.itemId || session.cart[0].itemId);
}

async function removeLine(session: SessionDoc): Promise<void> {
  const id = session.editingItemId;
  session.cart = session.cart.filter((l) => l.itemId !== id);
  session.editingItemId = undefined;
  session.markModified("cart");
  await showCart(session);
}

async function handleBack(session: SessionDoc): Promise<void> {
  if (session.state === "item_detail" || session.state === "choosing_qty") {
    if (session.categoryId) {
      await showItems(session, session.categoryId, session.page || 0);
      return;
    }
  }
  if (session.state === "editing_line") {
    await showEditCart(session);
    return;
  }
  await showCategories(session, 0);
}

async function startCheckout(session: SessionDoc): Promise<void> {
  if (!session.cart.length) {
    await showCart(session);
    return;
  }
  if (session.state === "awaiting_payment" && session.checkout.pendingOrderId) {
    await payAgain(session);
    return;
  }
  session.state = "checkout_fulfillment";
  await session.save();
  await sendButtons(
    session.waPhone,
    `${renderCart(session.cart)}\n\nIs this for dine in or parcel?`,
    [
      { id: "DINE_IN", title: "Dine in" },
      { id: "PARCEL", title: "Parcel" },
      { id: "CANCEL", title: "Cancel" },
    ]
  );
}

async function handleTableNumber(
  session: SessionDoc,
  text: string
): Promise<void> {
  const n = text.replace(/[^\d]/g, "");
  const num = Number(n);
  if (!n || num < 1 || num > 99) {
    await sendText(
      session.waPhone,
      "Please send a table number between 1 and 99."
    );
    return;
  }
  session.checkout = { ...session.checkout, tableNumber: String(num) };
  session.state = "checkout_name";
  await session.save();
  await sendText(session.waPhone, "What name should we put on the order?");
}

async function handleName(session: SessionDoc, text: string): Promise<void> {
  const name = text.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 40) {
    await sendText(session.waPhone, "Please send a name (2–40 characters).");
    return;
  }
  session.checkout = { ...session.checkout, customerName: name };
  await showConfirm(session);
}

async function showConfirm(session: SessionDoc): Promise<void> {
  if (!session.cart.length || !session.checkout.fulfillment || !session.checkout.customerName) {
    await startCheckout(session);
    return;
  }
  session.state = "checkout_confirm";
  await session.save();
  const where =
    session.checkout.fulfillment === "dine_in"
      ? `Dine in · Table ${session.checkout.tableNumber}`
      : "Parcel";
  const body = [
    "*Confirm order*",
    "",
    where,
    session.checkout.customerName,
    "",
    renderCart(session.cart).replace("*Your cart*\n\n", ""),
    "",
    "Tap Pay now to open UPI / card.",
  ].join("\n");
  await sendButtons(session.waPhone, body, [
    { id: "PAY_NOW", title: "Pay now" },
    { id: "CANCEL", title: "Cancel" },
  ]);
}

async function placeAndPay(session: SessionDoc): Promise<void> {
  if (!session.cart.length) {
    await showCart(session);
    return;
  }
  const { fulfillment, tableNumber, customerName } = session.checkout;
  if (!fulfillment || !customerName) {
    await startCheckout(session);
    return;
  }
  if (fulfillment === "dine_in" && !tableNumber) {
    session.state = "checkout_table";
    await session.save();
    await sendText(session.waPhone, "What is your table number?");
    return;
  }

  if (session.checkout.pendingOrderId) {
    const existing = await Order.findById(session.checkout.pendingOrderId);
    if (existing && existing.status === "awaiting_payment") {
      existing.status = "cancelled";
      await existing.save();
    }
  }

  const order = await Order.create({
    waPhone: session.waPhone,
    customerName,
    fulfillment,
    tableNumber: fulfillment === "dine_in" ? tableNumber : undefined,
    items: session.cart.map((l) => ({
      itemId: l.itemId,
      name: l.name,
      pricePaise: l.pricePaise,
      qty: l.qty,
    })),
    totalPaise: cartTotalPaise(session.cart),
    status: "awaiting_payment",
  });

  session.checkout.pendingOrderId = String(order.id);
  session.state = "awaiting_payment";
  await session.save();

  let link: { id: string; shortUrl: string } | null = null;
  try {
    link = await createPaymentLink(order);
  } catch (err) {
    console.error("Razorpay link failed", err);
  }
  if (link) {
    order.razorpayPaymentLinkId = link.id;
    order.razorpayPaymentLinkUrl = link.shortUrl;
    await order.save();
    await sendPayCta(session.waPhone, order.totalPaise, link.shortUrl);
    return;
  }

  await sendButtons(
    session.waPhone,
    `Order saved for ${formatInr(order.totalPaise)}. Payment is not available right now. Ask the staff, or tap Pay again.`,
    [
      { id: "PAY_AGAIN", title: "Pay again" },
      { id: "CANCEL", title: "Cancel" },
      { id: "HELP", title: "Help" },
    ]
  );
}

async function payAgain(session: SessionDoc): Promise<void> {
  const id = session.checkout.pendingOrderId;
  if (!id) {
    await startCheckout(session);
    return;
  }
  const order = await Order.findById(id);
  if (!order || !["awaiting_payment", "payment_failed"].includes(order.status)) {
    await sendText(session.waPhone, "That order is no longer waiting for payment.");
    await showWelcome(session);
    return;
  }
  if (order.status === "payment_failed") {
    order.status = "awaiting_payment";
  }
  if (order.razorpayPaymentLinkUrl) {
    await order.save();
    await sendPayCta(session.waPhone, order.totalPaise, order.razorpayPaymentLinkUrl);
    return;
  }
  const link = await createPaymentLink(order);
  if (link) {
    order.razorpayPaymentLinkId = link.id;
    order.razorpayPaymentLinkUrl = link.shortUrl;
    await order.save();
    await sendPayCta(session.waPhone, order.totalPaise, link.shortUrl);
    return;
  }
  await sendText(
    session.waPhone,
    razorpayConfigured
      ? "Could not create a payment link. Please try again."
      : "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
  );
}

async function sendPayCta(
  waPhone: string,
  totalPaise: number,
  url: string
): Promise<void> {
  await sendCtaUrl(
    waPhone,
    `Pay ${formatInr(totalPaise)} to place this order. After you pay, your token number will appear here.`,
    "Pay now",
    url,
    { header: "Payment", footer: "UPI, card, netbanking" }
  );
  await sendButtons(waPhone, "Need to change this order?", [
    { id: "PAY_AGAIN", title: "Send link again" },
    { id: "CANCEL", title: "Cancel" },
    { id: "HELP", title: "Help" },
  ]);
}

async function handleCancel(session: SessionDoc): Promise<void> {
  if (session.checkout.pendingOrderId) {
    const order = await Order.findById(session.checkout.pendingOrderId);
    if (order && order.status === "awaiting_payment") {
      order.status = "cancelled";
      await order.save();
    }
  }
  session.checkout = {};
  session.state = "cart";
  await session.save();
  await sendText(session.waPhone, "Cancelled. Your cart is still here.");
  await showCart(session);
}

async function findAvailableItem(itemId: string) {
  if (!mongoose.isValidObjectId(itemId)) return null;
  return MenuItem.findOne({ _id: itemId, isAvailable: true });
}

export { showWelcome };
