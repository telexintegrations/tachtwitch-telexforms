import express from "express";
import { config } from "dotenv";
import { sendToTelex } from "./telex.js";
import { jsonToText } from "./utils.js";
import path from "path"
import { integration } from "./integration.js";
import multer from "multer";
import cors from "cors";

config();

// Serve static files from the public directory

const app = express();
const port = process.env.PORT;
const root = path.resolve('./')
app.use(cors())
app.use(express.static(root+ '/public'));

const upload = multer();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", (req, res) => {
  res.sendFile(root+"/public/form.html");
});

app.get("/integration.json", (req, res) => {
  res.json(integration);
});

// Reject non-POST requests
const rejectNonPostRequests = (req, res, next) => {
  if (req.method !== "POST") {
    res.status(405).send({ error: "Method Not Allowed" });
  } else {
    next();
  }
};

app.use(rejectNonPostRequests);

//webhook
app.post("/webhook", async (req, res) => {
  try {
    const { message, settings } = req.body;

    // Validate request body
    if (!message || !settings) {
      return res.status(400).send({ error: "Invalid request" });
    }

    // Find max message length setting
    const maxWordsSetting = settings.find((setting) => setting.label === "maxMessageLength");

    // Check message length
    if (maxWordsSetting?.default < message.length) {
      return res.json({ status: "error", message: `Message length exceeded ${maxWordsSetting?.default}` });
    }

    // Process message
    if (typeof message === "object") {
      return res.json({ status: "success", message: `TelexForms Custom Form \n${jsonToText(message)}` });
    } else {
      return res.json({ status: "success", message: message });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// Submit form
app.post("/submit-form", upload.none(), async (req, res) => {
  try {
    
    const formData= req.body
    const webhook = req.query.webhook

    if (!formData || (req.body == null||undefined)) {
      return res.status(400).send({ error: "Invalid request" });
    }

    const TelexFormat = {
      event_name: "telexForms-response",
      message : jsonToText(formData),
      status: "success",
      username : "TelexForms",
    };

    await sendToTelex(TelexFormat,webhook);
    res.json(formData);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app;