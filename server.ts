import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import admin from "firebase-admin";
import webpush from "web-push";
import nodemailer from "nodemailer";
import { GoogleGenAI, Type } from "@google/genai";
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
  settings: []
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
    const PORT = 3000;

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

  // Reminder Check Loop
  setInterval(async () => {
    try {
      const now = new Date();
      const subscriptions = await getCollection("push_subscriptions") as any[];
      const allMembers = await getCollection("family_members") as any[];
      const canSendPush = subscriptions.length > 0;
      const emailConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
      
      if (!canSendPush && !emailConfigured) return;
      
      // Check Events
      let upcomingEvents: any[] = [];
      try {
        const allEvents = await getCollection("events");
        upcomingEvents = allEvents.filter(event => 
          event.reminder_minutes != null && 
          event.start_time && 
          new Date(event.start_time) > now
        );
      } catch (e: any) {
        console.error("Error fetching events for reminders:", e.message);
      }
      
      for (const event of upcomingEvents) {
        try {
          const startTime = new Date(event.start_time);
          const reminderTime = new Date(startTime.getTime() - event.reminder_minutes * 60000);
          
          if (now >= reminderTime && now.getTime() - reminderTime.getTime() < 60000) {
            const payload = JSON.stringify({
              title: "Muistutus: " + event.title,
              body: `Alkaa klo ${startTime.toLocaleTimeString('fi-FI', { timeZone: 'Europe/Helsinki', hour: '2-digit', minute: '2-digit' })}`,
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
                  text: `Muistutus tapahtumasta!\n\nNimi: ${event.title}\nAlkaa: ${startTime.toLocaleTimeString('fi-FI', { timeZone: 'Europe/Helsinki', hour: '2-digit', minute: '2-digit' })}\n\nAvaa sovellus nähdäksesi lisätiedot.`
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
          new Date(todo.due_date) > now
        );
      } catch (e: any) {
        console.error("Error fetching todos for reminders:", e.message);
      }
      
      for (const todo of upcomingTodos) {
        try {
          const dueDate = new Date(todo.due_date);
          const reminderTime = new Date(dueDate.getTime() - todo.reminder_minutes * 60000);

          if (now >= reminderTime && now.getTime() - reminderTime.getTime() < 60000) {
            const payload = JSON.stringify({
              title: "Tehtävämuistutus: " + todo.task,
              body: `Erääntyy klo ${dueDate.toLocaleTimeString('fi-FI', { timeZone: 'Europe/Helsinki', hour: '2-digit', minute: '2-digit' })}`,
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
                  text: `Muistutus tehtävästä!\n\nTehtävä: ${todo.task}\nErääntyy: ${dueDate.toLocaleTimeString('fi-FI', { timeZone: 'Europe/Helsinki', hour: '2-digit', minute: '2-digit' })}\n\nAvaa sovellus nähdäksesi lisätiedot.`
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
          }
        } catch (todoErr) {}
      }
    } catch (err: any) {
      console.error("Reminder check loop failed:", err.message);
    }
  }, 60000);

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

  app.post("/api/ai/generate-meal-plan", async (req, res) => {
    const { prompt, planDays } = req.body;
    try {
      let apiKey = process.env.GEMINI_API_KEY_PAID || process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (apiKey === "MY_GEMINI_API_KEY") {
        apiKey = process.env.API_KEY;
      }
      
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        return res.status(500).json({ error: "API Key is not configured correctly. Please check your AI Studio Settings." });
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recipes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    servings: { type: Type.NUMBER },
                    ingredients: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          item: { type: Type.STRING },
                          amount: { type: Type.STRING }
                        },
                        required: ["item", "amount"]
                      }
                    },
                    instructions: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    }
                  },
                  required: ["title", "ingredients", "instructions", "servings"]
                }
              }
            },
            required: ["recipes"]
          }
        }
      });

      const data = JSON.parse(response.text || '{"recipes":[]}');
      res.json(data);
    } catch (error: any) {
      console.error("AI Meal Plan Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate meal plan" });
    }
  });

  app.post("/api/ai/generate-recipe", async (req, res) => {
    const { ingredients } = req.body;
    try {
      let apiKey = process.env.GEMINI_API_KEY_PAID || process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (apiKey === "MY_GEMINI_API_KEY") {
        apiKey = process.env.API_KEY;
      }
      
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        return res.status(500).json({ error: "API Key is not configured correctly. Please check your AI Studio Settings." });
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Luo herkullinen resepti näistä raaka-aineista: ${ingredients}. Vastaa suomeksi. Reseptin pitää olla laktoositon ja sopia lapsiperheelle (ei liian mausteinen). Ilmoita myös kuinka monta annosta reseptistä saadaan.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              servings: { type: Type.NUMBER },
              ingredients: { 
                type: Type.ARRAY,
                items: { 
                  type: Type.OBJECT,
                  properties: {
                    item: { type: Type.STRING },
                    amount: { type: Type.STRING }
                  },
                  required: ["item", "amount"]
                }
              },
              instructions: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["title", "ingredients", "instructions", "servings"]
          }
        }
      });
      
      const data = JSON.parse(response.text || '{}');
      res.json(data);
    } catch (error: any) {
      console.error("AI Recipe Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate recipe" });
    }
  });

  app.post("/api/ai/swap-meal", async (req, res) => {
    const { prompt } = req.body;
    try {
      let apiKey = process.env.GEMINI_API_KEY_PAID || process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (apiKey === "MY_GEMINI_API_KEY") {
        apiKey = process.env.API_KEY;
      }
      
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        return res.status(500).json({ error: "API Key is not configured correctly. Please check your AI Studio Settings." });
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              servings: { type: Type.NUMBER },
              ingredients: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    item: { type: Type.STRING },
                    amount: { type: Type.STRING }
                  },
                  required: ["item", "amount"]
                }
              },
              instructions: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["title", "ingredients", "instructions", "servings"]
          }
        }
      });

      const newRecipe = JSON.parse(response.text || '{}');
      res.json(newRecipe);
    } catch (error: any) {
      console.error("AI Swap Meal Error:", error);
      res.status(500).json({ error: error.message || "Failed to swap meal" });
    }
  });

  app.post("/api/ai/chat", async (req, res) => {
    const { query } = req.body;
    try {
      let apiKey = process.env.GEMINI_API_KEY_PAID || process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (apiKey === "MY_GEMINI_API_KEY") {
        apiKey = process.env.API_KEY;
      }
      
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        return res.status(500).json({ error: "API Key is not configured correctly. Please check your AI Studio Settings." });
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Olet perheen arjen apulainen. Vastaa lyhyesti ja ytimekkäästi suomeksi. Käyttäjän kysymys: ${query}`,
      });
      
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("AI Chat Error:", error);
      res.status(500).json({ error: error.message || "Failed to get AI response" });
    }
  });

  app.post("/api/ai/create-events", async (req, res) => {
    const { prompt, systemInstruction } = req.body;
    try {
      let apiKey = process.env.GEMINI_API_KEY_PAID || process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (apiKey === "MY_GEMINI_API_KEY") {
        apiKey = process.env.API_KEY;
      }
      
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        return res.status(500).json({ error: "API Key is not configured correctly. Please check your AI Studio Settings." });
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                start_time: { type: Type.STRING, description: "Format: YYYY-MM-DDTHH:mm" },
                end_time: { type: Type.STRING, description: "Format: YYYY-MM-DDTHH:mm" },
                member_ids: { 
                  type: Type.ARRAY,
                  items: { type: Type.INTEGER }
                },
                recurrence_type: { type: Type.STRING, description: "One of: 'none', 'daily', 'weekly', 'monthly'" }
              },
              required: ["title", "start_time", "end_time", "member_ids", "recurrence_type"]
            }
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error('AI ei palauttanut vastausta');
      
      const eventsToCreate = JSON.parse(text);
      res.json(eventsToCreate);
    } catch (error: any) {
      console.error("AI Create Events Error:", error);
      res.status(500).json({ error: error.message || "Failed to create events via AI" });
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
