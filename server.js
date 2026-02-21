import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const client = new Anthropic();

app.post("/api/craft-email", async (req, res) => {
  const { lead, emailType, customInstructions } = req.body;

  if (!lead || !emailType) {
    return res.status(400).json({ error: "lead and emailType are required" });
  }

  const leadContext = [
    `Company: ${lead.company}`,
    `Contact: ${lead.contact}`,
    lead.email ? `Email: ${lead.email}` : null,
    lead.phone ? `Phone: ${lead.phone}` : null,
    lead.stage ? `Pipeline Stage: ${lead.stage}` : null,
    lead.source ? `Lead Source: ${lead.source}` : null,
    lead.value ? `Deal Value: $${Number(lead.value).toLocaleString()}` : null,
    lead.notes ? `Notes: ${lead.notes}` : null,
    lead.followUp ? `Follow-up Date: ${lead.followUp}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const emailTypePrompts = {
    introduction: "Write a professional introduction email to establish first contact with this lead.",
    followup: "Write a follow-up email to check in on this lead and move the conversation forward.",
    proposal: "Write an email presenting a business proposal tailored to this lead's needs.",
    meeting: "Write an email requesting a meeting or call to discuss potential collaboration.",
    thankyou: "Write a thank-you email after a recent interaction with this lead.",
    closing: "Write a closing/deal-closing email to finalize the business relationship.",
  };

  const typePrompt = emailTypePrompts[emailType] || emailTypePrompts.introduction;

  const systemPrompt = `You are an expert B2B sales email writer. You craft concise, professional, and personalized emails that drive action. Keep emails under 200 words. Use the lead's context to personalize the message. Always include a clear call to action. Return ONLY the email content with Subject, then a blank line, then the body. Do not include any explanatory text outside the email.`;

  const userPrompt = `${typePrompt}

Lead Information:
${leadContext}
${customInstructions ? `\nAdditional Instructions: ${customInstructions}` : ""}

Write the email now. Start with "Subject: ..." on the first line, then the email body.`;

  try {
    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Claude API error:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate email. Check your ANTHROPIC_API_KEY." });
    }
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`AI Email server running on http://localhost:${PORT}`);
});
