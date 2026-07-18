/**
 * Monetization scaffolding: affiliate partner links and an opt-in email
 * capture. Everything here is placeholder-ready — swap the marked values
 * for real affiliate links and a real form endpoint once those accounts
 * are set up, and nothing else in the app needs to change.
 *
 * Affiliate links must be clearly disclosed per FTC endorsement guidelines
 * (see the disclosure text rendered alongside AFFILIATE_PARTNERS below) —
 * don't remove that disclosure if you edit this list.
 */

const AFFILIATE_PARTNERS = [
  {
    name: "Lively",
    category: "HSA provider",
    description: "A no-fee HSA with easy investing — pairs with the HSA strategy above.",
    // TODO: replace with your real Lively affiliate link once approved.
    url: "https://example.com/replace-with-your-lively-affiliate-link",
  },
  {
    name: "Betterment",
    category: "Robo-advisor",
    description: "Automated investing with straightforward Roth/Traditional IRA setup.",
    // TODO: replace with your real Betterment affiliate link once approved.
    url: "https://example.com/replace-with-your-betterment-affiliate-link",
  },
  {
    name: "Empower",
    category: "Net worth tracking",
    description: "Free net-worth and retirement tracking tools alongside this calculator.",
    // TODO: replace with your real Empower affiliate link once approved.
    url: "https://example.com/replace-with-your-empower-affiliate-link",
  },
];

// TODO: replace with your real form endpoint (e.g. https://formspree.io/f/xxxxxxx)
// once you've created one — until then, submissions will fail gracefully.
const EMAIL_CAPTURE_ENDPOINT = "https://formspree.io/f/YOUR_FORM_ID";
