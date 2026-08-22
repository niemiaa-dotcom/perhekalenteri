import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import admin from "firebase-admin";
import webpush from "web-push";
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase
const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
};

const isFirebaseConfigured = !!(firebaseConfig.projectId && firebaseConfig.clientEmail && firebaseConfig.privateKey);

if (isFirebaseConfigured) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(firebaseConfig as admin.ServiceAccount),
    });
    console.log("Firebase Admin initialized successfully");
  } catch (err) {
    console.error("Firebase initialization failed:", err);
  }
} else {
  console.warn("Firebase credentials missing. Falling back to ephemeral mode (data will be lost on restart).");
}

let firestore = isFirebaseConfigured ? admin.firestore() : null;
let isFirestoreAvailable = !!firestore;

// In-memory fallback storage
const memoryStorage: Record<string, any[]> = {
  family_members: [
    { id: "1", name: "Äiti", color: "#ef4444" },
    { id: "2", name: "Isä", color: "#3b82f6" },
    { id: "3", name: "Lapsi", color: "#10b981" }
  ],
  events: [],
  todos: [],
  shopping_list: [],
  saved_meal_plans: [],
  push_subscriptions: [],
  settings: [],
  recipes: [],
  pantry: []
};

// Helper to handle Firestore errors and fallback to memory
function handleFirestoreError(err: any, collectionName: string) {
  console.error(`Firestore error on ${collectionName}:`, err.message);
  if (err.message && err.message.includes('NOT_FOUND')) {
    console.warn("Firestore database not found. Falling back to in-memory storage.");
    isFirestoreAvailable = false;
  }
}

// Helper to get collection data
async function getCollection(collectionName: string) {
  if (!isFirestoreAvailable || !firestore) {
    return memoryStorage[collectionName] || [];
  }
  try {
    const snapshot = await firestore.collection(collectionName).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err: any) {
    handleFirestoreError(err, collectionName);
    return memoryStorage[collectionName] || [];
  }
}

// VAPID keys
let vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || "",
  privateKey: process.env.VAPID_PRIVATE_KEY || ""
};

if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  try {
    const generated = webpush.generateVAPIDKeys();
    vapidKeys = generated;
    console.log("Generated new VAPID keys.");
  } catch (err) {
    console.error("Failed to generate VAPID keys:", err);
  }
}

try {
  if (vapidKeys.publicKey && vapidKeys.privateKey) {
    webpush.setVapidDetails(
      "mailto:example@yourdomain.com",
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
  }
} catch (err) {
  console.error("Failed to set VAPID details:", err);
}

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Seed initial family members if empty (only if Firebase is configured)
async function seedInitialData() {
  if (!isFirestoreAvailable || !firestore) return;
  try {
    const membersRef = firestore.collection("family_members");
    const snapshot = await membersRef.limit(1).get();
    if (snapshot.empty) {
      console.log("No family members found, seeding defaults...");
      await membersRef.doc("1").set({ name: "Äiti", color: "#ef4444" });
      await membersRef.doc("2").set({ name: "Isä", color: "#3b82f6" });
      await membersRef.doc("3").set({ name: "Lapsi", color: "#10b981" });
      console.log("Seeded initial family members to Firestore");
    }
  } catch (err: any) {
    handleFirestoreError(err, "family_members");
    console.error("Seeding failed (this is expected if Firestore is not fully set up):", err.message);
  }
}

// Global error handling for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

async function startServer() {
  try {
    await seedInitialData();

    const app = express();
    // Hanki portti ympäristöstä (Cloud Run asettaa PORT=8080), oletus 3000 lokaaliin
    const PORT = Number(process.env.PORT) || 3000;

    app.use(express.json());

  // API Routes
  app.get("/api/members", async (req, res) => {
    const members = await getCollection("family_members");
    res.json(members);
  });

  app.post("/api/members", async (req, res) => {
    try {
      const { name, color, email } = req.body;
      if (!isFirestoreAvailable || !firestore) {
        const id = Date.now().toString();
        memoryStorage.family_members.push({ id, name, color, email });
        return res.json({ id });
      }
      const docRef = await firestore.collection("family_members").add({ name, color, email: email || "" });
      res.json({ id: docRef.id });
    } catch (err: any) {
      handleFirestoreError(err, "family_members");
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/members/:id", async (req, res) => {
    try {
      const { name, color, email } = req.body;
      if (!isFirestoreAvailable || !firestore) {
        const index = memoryStorage.family_members.findIndex(m => m.id === req.params.id);
        if (index !== -1) {
          memoryStorage.family_members[index] = { ...memoryStorage.family_members[index], name, color, email };
        }
        return res.json({ success: true });
      }
      await firestore.collection("family_members").doc(req.params.id).update({ name, color, email: email || "" });
      res.json({ success: true });
    } catch (err: any) {
      handleFirestoreError(err, "family_members");
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/members/:id", async (req, res) => {
    try {
      if (!isFirestoreAvailable || !firestore) {
        memoryStorage.family_members = memoryStorage.family_members.filter(m => m.id !== req.params.id);
        return res.json({ success: true });
      }
      await firestore.collection("family_members").doc(req.params.id).delete();
      res.json({ success: true });
    } catch (err: any) {
      handleFirestoreError(err, "family_members");
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/events", async (req, res) => {
    const events = await getCollection("events");
    res.json(events);
  });

  app.post("/api/events", async (req, res) => {
    try {
      const { title, description, start_time, end_time, member_ids, recurrence_type, reminder_minutes } = req.body;
      
      const sanitizedMemberIds = Array.isArray(member_ids) 
        ? member_ids.map(id => String(id)) 
        : [];

      const eventData = {
        title,
        description: description || "",
        start_time,
        end_time,
        member_ids: sanitizedMemberIds,
        recurrence_type: recurrence_type || 'none',
        reminder_minutes: reminder_minutes || null,
        created_at: new Date().toISOString()
      };

      if (!isFirestoreAvailable || !firestore) {
        const id = Date.now().toString();
        memoryStorage.events.push({ id, ...eventData });
        return res.json({ id });
      }

      const docRef = await firestore.collection("events").add(eventData);
      res.json({ id: docRef.id });
    } catch (err: any) {
      handleFirestoreError(err, "events");
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/events/:id", async (req, res) => {
    try {
      const { title, description, start_time, end_time, member_ids, recurrence_type, reminder_minutes } = req.body;
      const eventData = {
        title,
        description: description || "",
        start_time,
        end_time,
        member_ids: member_ids || [],
        recurrence_type: recurrence_type || 'none',
        reminder_minutes: reminder_minutes || null
      };

      if (!isFirestoreAvailable || !firestore) {
        const index = memoryStorage.events.findIndex(e => e.id === req.params.id);
        if (index !== -1) {
          memoryStorage.events[index] = { ...memoryStorage.events[index], ...eventData };
        }
        return res.json({ success: true });
      }

      await firestore.collection("events").doc(req.params.id).update(eventData);
      res.json({ success: true });
    } catch (err: any) {
      handleFirestoreError(err, "events");
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/events/:id", async (req, res) => {
    try {
      if (!isFirestoreAvailable || !firestore) {
        memoryStorage.events = memoryStorage.events.filter(e => e.id !== req.params.id);
        return res.json({ success: true });
      }
      await firestore.collection("events").doc(req.params.id).delete();
      res.json({ success: true });
    } catch (err: any) {
      handleFirestoreError(err, "events");
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/todos", async (req, res) => {
    try {
      const todos = await getCollection("todos");
      
      // Sort logic
      todos.sort((a: any, b: any) => {
        if (a.completed !== b.completed) return a.completed - b.completed;
        if (!a.due_date && b.due_date) return 1;
        if (a.due_date && !b.due_date) return -1;
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        return (b.created_at || "").localeCompare(a.created_at || "");
      });
      
      res.json(todos);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/todos", async (req, res) => {
    try {
      const { task, member_ids, due_date, reminder_minutes } = req.body;
      const todoData = {
        task,
        member_ids: member_ids || [],
        due_date: due_date || null,
        reminder_minutes: reminder_minutes || null,
        completed: 0,
        created_at: new Date().toISOString()
      };

      if (!isFirestoreAvailable || !firestore) {
        const id = Date.now().toString();
        memoryStorage.todos.push({ id, ...todoData });
        return res.json({ id });
      }

      const docRef = await firestore.collection("todos").add(todoData);
      res.json({ id: docRef.id });
    } catch (err: any) {
      handleFirestoreError(err, "todos");
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/todos/:id", async (req, res) => {
    try {
      const { completed, reminder_minutes, task, member_ids, due_date } = req.body;
      const updateData: any = {};
      if (completed !== undefined) updateData.completed = completed ? 1 : 0;
      if (reminder_minutes !== undefined) updateData.reminder_minutes = reminder_minutes;
      if (task !== undefined) updateData.task = task;
      if (member_ids !== undefined) updateData.member_ids = member_ids;
      if (due_date !== undefined) updateData.due_date = due_date;
      
      if (!isFirestoreAvailable || !firestore) {
        const index = memoryStorage.todos.findIndex(t => t.id === req.params.id);
        if (index !== -1) {
          memoryStorage.todos[index] = { ...memoryStorage.todos[index], ...updateData };
        }
        return res.json({ success: true });
      }

      await firestore.collection("todos").doc(req.params.id).update(updateData);
      res.json({ success: true });
    } catch (err: any) {
      handleFirestoreError(err, "todos");
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/todos/:id", async (req, res) => {
    try {
      if (!isFirestoreAvailable || !firestore) {
        memoryStorage.todos = memoryStorage.todos.filter(t => t.id !== req.params.id);
        return res.json({ success: true });
      }
      await firestore.collection("todos").doc(req.params.id).delete();
      res.json({ success: true });
    } catch (err: any) {
      handleFirestoreError(err, "todos");
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/push/public-key", (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
  });

  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const { subscription } = req.body;
      const subStr = JSON.stringify(subscription);
      
      if (!isFirestoreAvailable || !firestore) {
        if (!memoryStorage.push_subscriptions.some(s => s.subscription === subStr)) {
          memoryStorage.push_subscriptions.push({ id: Date.now().toString(), subscription: subStr });
        }
        return res.status(201).json({ success: true });
      }

      const snapshot = await firestore.collection("push_subscriptions").where("subscription", "==", subStr).get();
      if (snapshot.empty) {
        await firestore.collection("push_subscriptions").add({ subscription: subStr });
      }
      res.status(201).json({ success: true });
    } catch (err: any) {
      handleFirestoreError(err, "push_subscriptions");
      res.status(500).json({ error: "Failed to subscribe" });
    }
  });

  // Settings API removed as it is no longer needed

  app.get("/api/settings/email-status", (req, res) => {
    const configured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
    res.json({ configured });
  });

  app.post("/api/settings/test-email", async (req, res) => {
    try {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return res.status(400).json({ error: "Email credentials not configured" });
      }
      
      const { to } = req.body;
      if (!to) {
        return res.status(400).json({ error: "Missing 'to' address" });
      }

      const info = await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to,
        subject: "Perheen Seinä: Testiviesti",
        text: "Tämä on testiviesti Perheen Seinä -sovelluksesta. Sähköpostiasetukset toimivat!"
      });
      
      res.json({ success: true, info });
    } catch (err: any) {
      console.error("Test email failed:", err);
      res.status(500).json({ error: err.message, stack: err.stack });
    }
  });

  // ==== Reminder check ====
  // Ajaa muistutustarkistuksen: lähettää sähköpostin + push-ilmoituksen
  // tapahtumista/tehtävistä, joiden muistutusaika on mennyt (mutta itse
  // tapahtuma ei ole vielä alkanut). `reminder_sent_at`-lippu estää
  // uudelleenlähetykset ja mahdollistaa väliin jääneiden lähetyksen, kun
  // instanssi herää (Cloud Run jäädyttää joutilaan instanssin).
  async function runReminderCheck() {
    try {
      const now = new Date();
      const subscriptions = await getCollection("push_subscriptions") as any[];
      const allMembers = await getCollection("family_members") as any[];
      const canSendPush = subscriptions.length > 0;
      const emailConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);

      if (!canSendPush && !emailConfigured) return;

      const markSent = async (collectionName: string, id: string) => {
        const sentAt = new Date().toISOString();
        if (!isFirestoreAvailable || !firestore) {
          const arr = memoryStorage[collectionName] as any[];
          const idx = arr.findIndex(x => x.id === id);
          if (idx !== -1) arr[idx].reminder_sent_at = sentAt;
          return;
        }
        try {
          await firestore.collection(collectionName).doc(id).update({ reminder_sent_at: sentAt });
        } catch (err: any) {
          handleFirestoreError(err, collectionName);
        }
      };

      const fmtHelsinki = (d: Date, withDate = true) => {
        const datePart = withDate ? d.toLocaleDateString('fi-FI', { timeZone: 'Europe/Helsinki', day: 'numeric', month: 'numeric' }) + " klo " : "";
        return datePart + d.toLocaleTimeString('fi-FI', { timeZone: 'Europe/Helsinki', hour: '2-digit', minute: '2-digit' });
      };

      // Check Events
      let upcomingEvents: any[] = [];
      try {
        const allEvents = await getCollection("events");
        upcomingEvents = allEvents.filter(event =>
          event.reminder_minutes != null &&
          event.start_time &&
          new Date(event.start_time) > now &&
          !event.reminder_sent_at
        );
      } catch (e: any) {
        console.error("Error fetching events for reminders:", e.message);
      }

      for (const event of upcomingEvents) {
        try {
          const startTime = new Date(event.start_time);
          const reminderTime = new Date(startTime.getTime() - event.reminder_minutes * 60000);

          if (now >= reminderTime) {
            const payload = JSON.stringify({
              title: "Muistutus: " + event.title,
              body: `Alkaa ${fmtHelsinki(startTime)}`,
              url: "/?tab=calendar"
            });

            if (emailConfigured) {
              let targetEmails: string[] = [];
              if (event.member_ids && event.member_ids.length > 0) {
                targetEmails = allMembers
                  .filter(m => event.member_ids.includes(m.id) && m.email)
                  .map(m => m.email);
              }

              targetEmails = [...new Set(targetEmails)];

              if (targetEmails.length > 0) {
                transporter.sendMail({
                  from: process.env.EMAIL_USER,
                  to: targetEmails.join(','),
                  subject: `Perheen Seinä: ${event.title}`,
                  text: `Muistutus tapahtumasta!\n\nNimi: ${event.title}\nAlkaa: ${fmtHelsinki(startTime)}\n\nAvaa sovellus nähdäksesi lisätiedot.`
                }).catch(err => console.error("Failed to send email:", err));
              }
            }

            subscriptions.forEach(sub => {
              if (!sub.subscription) return;
              webpush.sendNotification(JSON.parse(sub.subscription), payload).catch(async err => {
                if (err.statusCode === 410 && sub.id) {
                  try {
                    if (isFirestoreAvailable && firestore) {
                      await firestore.collection("push_subscriptions").doc(sub.id).delete();
                    } else {
                      memoryStorage.push_subscriptions = memoryStorage.push_subscriptions.filter(s => s.id !== sub.id);
                    }
                  } catch (delErr) {}
                }
              });
            });

            await markSent("events", event.id);
          }
        } catch (eventErr) {}
      }

      // Check Todos
      let upcomingTodos: any[] = [];
      try {
        const allTodos = await getCollection("todos");
        upcomingTodos = allTodos.filter(todo =>
          todo.reminder_minutes != null &&
          todo.completed === 0 &&
          todo.due_date &&
          new Date(todo.due_date) > now &&
          !todo.reminder_sent_at
        );
      } catch (e: any) {
        console.error("Error fetching todos for reminders:", e.message);
      }

      for (const todo of upcomingTodos) {
        try {
          const dueDate = new Date(todo.due_date);
          const reminderTime = new Date(dueDate.getTime() - todo.reminder_minutes * 60000);

          if (now >= reminderTime) {
            const payload = JSON.stringify({
              title: "Tehtävämuistutus: " + todo.task,
              body: `Erääntyy ${fmtHelsinki(dueDate)}`,
              url: "/?tab=todos"
            });

            if (emailConfigured) {
              let targetEmails: string[] = [];
              if (todo.member_ids && todo.member_ids.length > 0) {
                targetEmails = allMembers
                  .filter(m => todo.member_ids.includes(m.id) && m.email)
                  .map(m => m.email);
              }

              targetEmails = [...new Set(targetEmails)];

              if (targetEmails.length > 0) {
                transporter.sendMail({
                  from: process.env.EMAIL_USER,
                  to: targetEmails.join(','),
                  subject: `Perheen Seinä: ${todo.task}`,
                  text: `Muistutus tehtävästä!\n\nTehtävä: ${todo.task}\nErääntyy: ${fmtHelsinki(dueDate)}\n\nAvaa sovellus nähdäksesi lisätiedot.`
                }).catch(err => console.error("Failed to send email:", err));
              }
            }

            subscriptions.forEach(sub => {
              if (!sub.subscription) return;
              webpush.sendNotification(JSON.parse(sub.subscription), payload).catch(async err => {
                if (err.statusCode === 410 && sub.id) {
                  try {
                    if (isFirestoreAvailable && firestore) {
                      await firestore.collection("push_subscriptions").doc(sub.id).delete();
                    } else {
                      memoryStorage.push_subscriptions = memoryStorage.push_subscriptions.filter(s => s.id !== sub.id);
                    }
                  } catch (delErr) {}
                }
              });
            });

            await markSent("todos", todo.id);
          }
        } catch (todoErr) {}
      }
    } catch (err: any) {
      console.error("Reminder check loop failed:", err.message);
    }
  }

  // Aja heti käynnistyksessä (lähettää väliin jääneet muistutukset deployn jälkeen)
  runReminderCheck();

  // Minuutin välein, kun instanssi on elossa
  setInterval(runReminderCheck, 60000);

  // Cloud Scheduler -endpoint serverless-ympäristöä varten:
  // Cloud Run jäädyttää joutilaan instanssin, joten setInterval ei yksin riitä.
  // Cloud Scheduler kutsuu tätä säännöllisesti (esim. joka minuutti).
  // Suojaus: jos CRON_SECRET on asetettu, kutsu vaatii ?secret=<arvo>.
  app.get("/api/cron/check-reminders", async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (secret && req.query.secret !== secret) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await runReminderCheck();
    res.json({ success: true, checkedAt: new Date().toISOString() });
  });

  app.get("/api/shopping", async (req, res) => {
    try {
      const items = await getCollection("shopping_list");
      items.sort((a: any, b: any) => {
        if (a.completed !== b.completed) return a.completed - b.completed;
        return (b.created_at || "").localeCompare(a.created_at || "");
      });
      res.json(items);
    } catch (err: any) {
      console.error("Error fetching shopping list:", err.message);
      res.json([]);
    }
  });

  app.post("/api/shopping", async (req, res) => {
    try {
      const { item, amount } = req.body;
      const itemData = {
        item,
        amount: amount || null,
        completed: 0,
        created_at: new Date().toISOString()
      };

      if (!isFirestoreAvailable || !firestore) {
        const id = Date.now().toString();
        memoryStorage.shopping_list.push({ id, ...itemData });
        return res.json({ id });
      }

      const docRef = await firestore.collection("shopping_list").add(itemData);
      res.json({ id: docRef.id });
    } catch (err: any) {
      handleFirestoreError(err, "shopping_list");
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/shopping/:id", async (req, res) => {
    try {
      const { completed } = req.body;
      
      if (!isFirestoreAvailable || !firestore) {
        const index = memoryStorage.shopping_list.findIndex(i => i.id === req.params.id);
        if (index !== -1) {
          memoryStorage.shopping_list[index].completed = completed ? 1 : 0;
        }
        return res.json({ success: true });
      }

      await firestore.collection("shopping_list").doc(req.params.id).update({ completed: completed ? 1 : 0 });
      res.json({ success: true });
    } catch (err: any) {
      handleFirestoreError(err, "shopping_list");
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/shopping/:id", async (req, res) => {
    try {
      if (!isFirestoreAvailable || !firestore) {
        memoryStorage.shopping_list = memoryStorage.shopping_list.filter(i => i.id !== req.params.id);
        return res.json({ success: true });
      }
      await firestore.collection("shopping_list").doc(req.params.id).delete();
      res.json({ success: true });
    } catch (err: any) {
      handleFirestoreError(err, "shopping_list");
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/shopping", async (req, res) => {
    try {
      if (!isFirestoreAvailable || !firestore) {
        memoryStorage.shopping_list = memoryStorage.shopping_list.filter(i => i.completed !== 1);
        return res.json({ success: true });
      }
      const snapshot = await firestore.collection("shopping_list").where("completed", "==", 1).get();
      if (snapshot.empty) return res.json({ success: true });
      const batch = firestore.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      res.json({ success: true });
    } catch (err: any) {
      handleFirestoreError(err, "shopping_list");
      res.status(500).json({ error: err.message });
    }
  });

  // ==== Recipes API (reseptipankki) ====
  app.get("/api/recipes", async (req, res) => {
    try {
      let recipes = await getCollection("recipes");
      const { category, diet_tags, q } = req.query;
      if (category) {
        recipes = recipes.filter((r: any) => r.category === category);
      }
      if (diet_tags) {
        const tags = String(diet_tags).split(",").map(t => t.trim());
        recipes = recipes.filter((r: any) => {
          const rTags: string[] = r.diet_tags || [];
          return tags.every(t => rTags.includes(t));
        });
      }
      if (q) {
        const query = String(q).toLowerCase();
        recipes = recipes.filter((r: any) =>
          (r.title || "").toLowerCase().includes(query) ||
          (r.description || "").toLowerCase().includes(query)
        );
      }
      recipes.sort((a: any, b: any) => (b.created_at || "").localeCompare(a.created_at || ""));
      res.json(recipes);
    } catch (err: any) {
      handleFirestoreError(err, "recipes");
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/recipes", async (req, res) => {
    try {
      const { title, description, category, servings, ingredients, instructions, diet_tags, source, notes, favorite } = req.body;
      if (!title || !title.trim()) {
        return res.status(400).json({ error: "Reseptin nimi on pakollinen" });
      }
      const recipeData = {
        title,
        description: description || "",
        category: category || "pääruoka",
        servings: servings || 4,
        ingredients: ingredients || [],
        instructions: instructions || [],
        diet_tags: diet_tags || [],
        source: source || "perhe",
        notes: notes || "",
        favorite: favorite || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (!isFirestoreAvailable || !firestore) {
        const id = Date.now().toString();
        memoryStorage.recipes = memoryStorage.recipes || [];
        memoryStorage.recipes.push({ id, ...recipeData });
        return res.json({ id });
      }

      const docRef = await firestore.collection("recipes").add(recipeData);
      res.json({ id: docRef.id });
    } catch (err: any) {
      handleFirestoreError(err, "recipes");
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/recipes/:id", async (req, res) => {
    try {
      const { title, description, category, servings, ingredients, instructions, diet_tags, source, notes, favorite } = req.body;
      const updateData: any = { updated_at: new Date().toISOString() };
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (category !== undefined) updateData.category = category;
      if (servings !== undefined) updateData.servings = servings;
      if (ingredients !== undefined) updateData.ingredients = ingredients;
      if (instructions !== undefined) updateData.instructions = instructions;
      if (diet_tags !== undefined) updateData.diet_tags = diet_tags;
      if (source !== undefined) updateData.source = source;
      if (notes !== undefined) updateData.notes = notes;
      if (favorite !== undefined) updateData.favorite = favorite;

      if (!isFirestoreAvailable || !firestore) {
        const arr = memoryStorage.recipes || [];
        const index = arr.findIndex((r: any) => r.id === req.params.id);
        if (index !== -1) {
          arr[index] = { ...arr[index], ...updateData };
        }
        return res.json({ success: true });
      }

      await firestore.collection("recipes").doc(req.params.id).update(updateData);
      res.json({ success: true });
    } catch (err: any) {
      handleFirestoreError(err, "recipes");
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/recipes/:id", async (req, res) => {
    try {
      if (!isFirestoreAvailable || !firestore) {
        memoryStorage.recipes = (memoryStorage.recipes || []).filter((r: any) => r.id !== req.params.id);
        return res.json({ success: true });
      }
      await firestore.collection("recipes").doc(req.params.id).delete();
      res.json({ success: true });
    } catch (err: any) {
      handleFirestoreError(err, "recipes");
      res.status(500).json({ error: err.message });
    }
  });

  // ==== Pantry API (kaappi) ====
  app.get("/api/pantry", async (req, res) => {
    try {
      const items = await getCollection("pantry");
      items.sort((a: any, b: any) => (a.item || "").localeCompare(b.item || ""));
      res.json(items);
    } catch (err: any) {
      handleFirestoreError(err, "pantry");
      res.json([]);
    }
  });

  app.post("/api/pantry", async (req, res) => {
    try {
      const { item, amount, category } = req.body;
      if (!item || !item.trim()) {
        return res.status(400).json({ error: "Tuotteen nimi on pakollinen" });
      }
      const pantryData = {
        item,
        amount: amount || "",
        category: category || "muut",
        added_at: new Date().toISOString()
      };

      if (!isFirestoreAvailable || !firestore) {
        const id = Date.now().toString();
        memoryStorage.pantry = memoryStorage.pantry || [];
        memoryStorage.pantry.push({ id, ...pantryData });
        return res.json({ id });
      }

      const docRef = await firestore.collection("pantry").add(pantryData);
      res.json({ id: docRef.id });
    } catch (err: any) {
      handleFirestoreError(err, "pantry");
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/pantry/:id", async (req, res) => {
    try {
      if (!isFirestoreAvailable || !firestore) {
        memoryStorage.pantry = (memoryStorage.pantry || []).filter((p: any) => p.id !== req.params.id);
        return res.json({ success: true });
      }
      await firestore.collection("pantry").doc(req.params.id).delete();
      res.json({ success: true });
    } catch (err: any) {
      handleFirestoreError(err, "pantry");
      res.status(500).json({ error: err.message });
    }
  });

  // Yhteinen kauppalistaesikatselu: lataa kaappi, yhdistä ainekset, liputa kaapista löytyvät.
  // Käyttäjät: generate-from-mealplan ja generate-from-recipe.
  const buildShoppingPreview = async (
    recipeList: Array<{ title: string; ingredients: any[] }>
  ): Promise<Array<{ item: string; amount: string; source: string; already_in_pantry: boolean }>> => {
    // Hae pantry
    let pantryItems: string[] = [];
    if (isFirestoreAvailable && firestore) {
      const snap = await firestore.collection("pantry").get();
      pantryItems = snap.docs.map(doc => String((doc.data() as any).item || "").toLowerCase().trim());
    } else {
      pantryItems = (memoryStorage.pantry || []).map((p: any) => String(p.item || "").toLowerCase().trim());
    }

    const allIngredients: Record<string, { item: string; amount: string; source: string; recipeTitle: string; already_in_pantry: boolean }> = {};

    const addIngredient = (ing: any, recipeTitle: string) => {
      if (!ing || !ing.item) return;
      const key = String(ing.item).toLowerCase().trim();
      const normalized = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const isInPantry = pantryItems.includes(key) || pantryItems.includes(normalized);
      if (allIngredients[key]) {
        const prev = allIngredients[key];
        prev.amount = prev.amount ? (prev.amount + " + " + (ing.amount || "")) : (ing.amount || "1 kpl");
        prev.source += ", " + recipeTitle;
      } else {
        allIngredients[key] = {
          item: ing.item,
          amount: ing.amount || "1 kpl",
          source: recipeTitle,
          recipeTitle,
          already_in_pantry: isInPantry
        };
      }
    };

    recipeList.forEach(recipe => {
      (recipe.ingredients || []).forEach((ing: any) => addIngredient(ing, recipe.title || "Resepti"));
    });

    return Object.values(allIngredients).map((v: any) => ({
      item: v.item,
      amount: v.amount,
      source: v.source,
      already_in_pantry: v.already_in_pantry
    }));
  };

  // ==== Shopping list generation from meal plan (sis. pantry-suodatus) ====
  app.post("/api/shopping/generate-from-mealplan", async (req, res) => {
    try {
      const { meal_plan_id } = req.body;
      if (!meal_plan_id) {
        return res.status(400).json({ error: "meal_plan_id on pakollinen" });
      }

      // Hae viikkosuunnitelma
      let plan: any = null;
      if (isFirestoreAvailable && firestore) {
        const doc = await firestore.collection("saved_meal_plans").doc(meal_plan_id).get();
        if (doc.exists) plan = { id: doc.id, ...doc.data() };
      } else {
        plan = (memoryStorage.saved_meal_plans || []).find((p: any) => p.id === meal_plan_id);
      }
      if (!plan || !plan.plan_data) {
        return res.status(404).json({ error: "Suunnitelmaa ei löytynyt" });
      }

      // Hae reseptit hajautettuna id:llä
      let recipes: any[] = [];
      if (isFirestoreAvailable && firestore) {
        const snap = await firestore.collection("recipes").get();
        recipes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else {
        recipes = memoryStorage.recipes || [];
      }
      const recipeById: Record<string, any> = {};
      recipes.forEach((r: any) => { recipeById[r.id] = r; });

      // Kerää suunnitelman reseptit yhteiseen muotoon (title + ingredients)
      const planData = typeof plan.plan_data === "string" ? JSON.parse(plan.plan_data) : plan.plan_data;
      const recipeList: Array<{ title: string; ingredients: any[] }> = [];

      if (Array.isArray(planData.recipes)) {
        planData.recipes.forEach((recipe: any) => {
          recipeList.push({ title: recipe.title || "Resepti", ingredients: recipe.ingredients || [] });
        });
      } else {
        // Päiväkohtainen rakenne: käy läpi jokainen päivä, breakfast/lunch/dinner
        const dayKeys = Object.keys(planData).filter(k => k !== 'days' && k !== 'recipes');
        for (const day of dayKeys) {
          const meals = planData[day];
          if (!meals || typeof meals !== 'object') continue;
          const mealKeys = ['breakfast', 'lunch', 'dinner', 'leftovers'];
          for (const mealKey of mealKeys) {
            const meal = meals[mealKey];
            if (!meal) continue;
            if (meal.recipe_id && recipeById[meal.recipe_id]) {
              const r = recipeById[meal.recipe_id];
              recipeList.push({ title: r.title || "Resepti", ingredients: r.ingredients || [] });
            } else if (typeof meal === 'object' && meal.ingredients) {
              recipeList.push({ title: meal.title || "Ateria", ingredients: meal.ingredients });
            }
            // vapaa teksti (käsin kirjattu ateria) — ei pureta
          }
        }
      }

      const result = await buildShoppingPreview(recipeList);
      res.json(result);
    } catch (err: any) {
      console.error("Generate from mealplan error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/shopping/generate-from-recipe", async (req, res) => {
    try {
      const { recipe_id } = req.body;
      if (!recipe_id) {
        return res.status(400).json({ error: "recipe_id on pakollinen" });
      }

      let recipe: any = null;
      if (isFirestoreAvailable && firestore) {
        const doc = await firestore.collection("recipes").doc(recipe_id).get();
        if (doc.exists) recipe = { id: doc.id, ...doc.data() };
      } else {
        recipe = (memoryStorage.recipes || []).find((r: any) => r.id === recipe_id);
      }
      if (!recipe) {
        return res.status(404).json({ error: "Reseptiä ei löytynyt" });
      }

      const result = await buildShoppingPreview([{ title: recipe.title || "Resepti", ingredients: recipe.ingredients || [] }]);
      res.json(result);
    } catch (err: any) {
      console.error("Generate from recipe error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/export", async (req, res) => {
    const data = {
      members: await getCollection("family_members"),
      events: await getCollection("events"),
      todos: await getCollection("todos"),
      shopping: await getCollection("shopping_list"),
      mealPlans: await getCollection("saved_meal_plans")
    };
    res.json(data);
  });

  app.post("/api/import", async (req, res) => {
    const { members, events, todos, shopping, mealPlans } = req.body;
    
    try {
      if (!isFirestoreAvailable || !firestore) {
        if (members && Array.isArray(members)) memoryStorage.family_members = members;
        if (events && Array.isArray(events)) memoryStorage.events = events;
        if (todos && Array.isArray(todos)) memoryStorage.todos = todos;
        if (shopping && Array.isArray(shopping)) memoryStorage.shopping_list = shopping;
        if (mealPlans && Array.isArray(mealPlans)) memoryStorage.saved_meal_plans = mealPlans;
        return res.json({ success: true });
      }

      console.log("Starting import process...");
      // Clear existing
      const collections = ["family_members", "events", "todos", "shopping_list", "saved_meal_plans", "push_subscriptions"];
      for (const coll of collections) {
        const snapshot = await firestore.collection(coll).get();
        if (!snapshot.empty) {
          const batch = firestore.batch();
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
        }
      }

      // Import new
      if (members && Array.isArray(members)) {
        for (const m of members) {
          const { id, ...data } = m;
          // Ensure we use a string ID
          const memberId = id ? String(id) : undefined;
          if (memberId) {
            await firestore.collection("family_members").doc(memberId).set(data);
          } else {
            await firestore.collection("family_members").add(data);
          }
        }
      }

      if (events && Array.isArray(events)) {
        for (const e of events) {
          const { id, ...data } = e;
          if (typeof data.member_ids === 'string') {
            try {
              data.member_ids = JSON.parse(data.member_ids);
            } catch (pErr) {
              data.member_ids = [];
            }
          }
          // Ensure member_ids are strings
          if (Array.isArray(data.member_ids)) {
            data.member_ids = data.member_ids.map(mid => String(mid));
          }
          await firestore.collection("events").add(data);
        }
      }

      if (todos && Array.isArray(todos)) {
        for (const t of todos) {
          const { id, ...data } = t;
          if (typeof data.member_ids === 'string') {
            try {
              data.member_ids = JSON.parse(data.member_ids);
            } catch (pErr) {
              data.member_ids = [];
            }
          }
          // Ensure member_ids are strings
          if (Array.isArray(data.member_ids)) {
            data.member_ids = data.member_ids.map(mid => String(mid));
          }
          await firestore.collection("todos").add(data);
        }
      }

      if (shopping && Array.isArray(shopping)) {
        for (const s of shopping) {
          const { id, ...data } = s;
          await firestore.collection("shopping_list").add(data);
        }
      }

      if (mealPlans && Array.isArray(mealPlans)) {
        for (const mp of mealPlans) {
          const { id, ...data } = mp;
          if (typeof data.plan_data === 'string') {
            try {
              data.plan_data = JSON.parse(data.plan_data);
            } catch (pErr) {
              data.plan_data = {};
            }
          }
          await firestore.collection("saved_meal_plans").add(data);
        }
      }

      console.log("Import completed successfully");
      res.json({ success: true });
    } catch (err) {
      console.error("Import failed:", err);
      res.status(500).json({ error: "Import failed: " + (err instanceof Error ? err.message : String(err)) });
    }
  });

  app.get("/api/meal-plans", async (req, res) => {
    try {
      const plans = await getCollection("saved_meal_plans");
      plans.sort((a: any, b: any) => (b.created_at || "").localeCompare(a.created_at || ""));
      res.json(plans);
    } catch (err: any) {
      console.error("Error fetching meal plans:", err.message);
      res.json([]);
    }
  });

  app.post("/api/meal-plans", async (req, res) => {
    try {
      const { name, plan_data } = req.body;
      const planData = {
        name,
        plan_data: plan_data,
        created_at: new Date().toISOString()
      };

      if (!isFirestoreAvailable || !firestore) {
        const id = Date.now().toString();
        memoryStorage.saved_meal_plans.push({ id, ...planData });
        return res.json({ id });
      }

      const docRef = await firestore.collection("saved_meal_plans").add(planData);
      res.json({ id: docRef.id });
    } catch (err: any) {
      handleFirestoreError(err, "saved_meal_plans");
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/meal-plans/:id", async (req, res) => {
    try {
      if (!isFirestoreAvailable || !firestore) {
        memoryStorage.saved_meal_plans = memoryStorage.saved_meal_plans.filter(p => p.id !== req.params.id);
        return res.json({ success: true });
      }
      await firestore.collection("saved_meal_plans").doc(req.params.id).delete();
      res.json({ success: true });
    } catch (err: any) {
      handleFirestoreError(err, "saved_meal_plans");
      res.status(500).json({ error: err.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  } catch (err) {
    console.error("CRITICAL: Server failed to start:", err);
  }
}

startServer();
