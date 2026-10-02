# AI Strategy & Implementation Diagnostic — Setup guide

Three files:

| File | What it is |
|---|---|
| `index.html` | The diagnostic itself: one self-contained page you can host on your website. |
| `apps-script/Code.gs` | Google Apps Script that saves each response to a Google Sheet and builds your dashboard. |
| `SETUP.md` | This guide. |

---

## 1. Create the Google Sheet back end (about 10 minutes)

1. Create a new Google Sheet, for example "AI Diagnostic Responses". Use the Google account that should own the data.
2. In the sheet, go to **Extensions → Apps Script**.
3. Delete the sample code, paste in all of `apps-script/Code.gs`, and save.
4. *Optional:* set `NOTIFY_EMAIL` near the top (for example `'andrew.gaule@aimava.com'`). You'll then get an email for every new response.
5. Pick **setup** from the function dropdown and click **Run**. Google will ask for authorisation. Approve it; this is your own script acting on your own sheet.
   This creates two tabs:
   - **Responses**: one row per submission. It includes contact details, pain / prize / obstacle, all 15 answers, the P scores, total, stage, strongest and weakest P, consent, and UTM source/campaign. There is also a **Follow-up status** dropdown (New → Contacted → Meeting booked → Proposal → Won / Not now) and a Notes column for your pipeline.
   - **Dashboard**: response count, average total, opt-ins, responses in the last 30 days, average by P, stage distribution, how often each P is weakest, top frustrations / prizes / obstacles, responses by campaign, and two charts.
6. Click **Deploy → New deployment**, choose the gear icon → **Web app**, then set:
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**. This is needed so anonymous visitors can submit. They can only submit; they cannot read the sheet.
7. Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).

> If you edit `apps-script/Code.gs` later, use **Deploy → Manage deployments → Edit → Version: New version**. This keeps the same URL. A *new* deployment would give you a new URL.

## 2. Configure the page

Open `index.html` in a text editor and find the `CONFIG` block near the top of the script:

```js
ENDPOINT_URL: "https://script.google.com/macros/s/XXXX/exec",  // from step 1.7
CTA_URL: "https://…",        // your booking link (e.g. Calendly / Microsoft Bookings)
CTA_LABEL: "Book a 30-minute results conversation",
SECONDARY_URL: "",           // optional second button, e.g. workshop or programme page
PRIVACY_URL: "https://…",    // your privacy notice
```

The `CTA_URL` and `PRIVACY_URL` values are placeholders that I guessed (`aimava.com/contact` and `/privacy`). Please replace them with your real links.

While `ENDPOINT_URL` is empty the page still works, but nothing is saved. That makes it safe for previewing.

## 3. Host it

The page is a single file with no external dependencies. Options:
- **Your website:** upload it as a page (e.g. `aimava.com/ai-diagnostic`). On WordPress or Squarespace you can paste it into a full-width "custom HTML / code" block, or host the file and embed it with an `<iframe>`. Platform behaviour varies, so test it once.
- **Free static hosting:** Netlify Drop, GitHub Pages or Cloudflare Pages all accept a single HTML file.

## 4. Test before launch

1. Open the page and complete it with test data.
2. Check that a row appears in **Responses** and the Dashboard updates.
3. Click **Download report (PDF)** and choose *Save as PDF* to check the report.
4. Delete your test row.

## 5. Link it from your posts (pain → prize → obstacle → diagnostic)

Add UTM tags to every link so the Dashboard shows which post or news item drove each response:

```
https://yoursite.com/ai-diagnostic?utm_source=linkedin&utm_medium=social&utm_campaign=2026-10-ai-pilot-fatigue
```

Use one `utm_campaign` per post or news hook. "Responses by campaign" on the Dashboard then shows which themes resonate. The pain / prize / obstacle tallies show what people are actually struggling with, which feeds your next posts.

## 6. Data protection (UK GDPR)

I'm not a lawyer, so please check these points with your own adviser:
- The page asks for explicit consent to store responses and links to your privacy notice. Make sure that notice covers this diagnostic: what is collected, why, how long it's kept, and that it's held in Google Workspace.
- Marketing consent is a separate, optional, unticked box. Only add people to a mailing list if **Marketing opt-in = Yes**.
- Decide on a retention period and delete old rows periodically.

## How scoring works

- 15 statements, each scored 1–5. Each P is out of 15; the total is out of 75.
- Stages: 15–30 Exploring, 31–45 Developing, 46–60 Implementing, 61–75 Scaling (from your original text).
- Strongest and weakest P are the highest and lowest P scores. Ties are shown together.
- Suggested actions come from the weakest P, using one of three bands: low (3–7), mid (8–11), high (12–15).
- The obstacle the respondent chose adds a short tailored note.
- The Sheet **recalculates scores on the server**, so stored figures can't be altered by a visitor.

All wording (questions, stages, actions, obstacle notes) lives in clearly labelled blocks near the top of the script in `index.html`, so you can edit it without touching the logic.

## Known limitations

- **No automatic results email to the respondent.** The PDF is created in their browser. Apps Script *can* email them, but sending automated emails to people you don't know has deliverability and consent implications. If you want that, I can add it as a next step.
- **Spam:** a hidden honeypot field filters simple bots. If you get heavy spam, add a CAPTCHA or move to a form service.
- **Fonts:** the page uses Century Gothic where it's installed (most Windows and Mac machines). Otherwise it falls back to a similar system font.
- Apps Script has daily quotas (e.g. on emails sent). These should be comfortably above campaign-level volumes, but check Google's current quota page if you expect thousands of responses a day.
