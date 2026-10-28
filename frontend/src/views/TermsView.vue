<script setup>
import { ShieldAlert, TriangleAlert } from 'lucide-vue-next';
import LegalPage from '@/components/LegalPage.vue';
import { SUPPORT_EMAIL } from '@/constants/legal';

const sections = [
  { id: 'account', label: 'Your account' },
  { id: 'guidelines', label: 'Community guidelines' },
  { id: 'misuse', label: 'Misusing profiles and data' },
  { id: 'chat', label: 'Chatting' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'market', label: 'Marketplace rules' },
  { id: 'work', label: 'Hiring and work' },
  { id: 'safety', label: 'Safety tips' },
  { id: 'enforcement', label: 'What happens if rules are broken' },
  { id: 'plans', label: 'Plans' },
  { id: 'liability', label: 'Our role and liability' },
  { id: 'contact', label: 'Reporting and contact' },
];
</script>

<template>
  <LegalPage
    title="Terms & community guidelines"
    intro="By creating an account or using ProfileHUB you agree to these terms. They exist to keep members safe and the community trustworthy, so please read the guidelines and safety tips."
    :sections="sections"
  >
    <h2 id="account">Your account</h2>
    <ul>
      <li>You must be at least 18 and use your real name and real details.</li>
      <li>New accounts are reviewed by an admin before you can sign in. We may decline sign-ups that look fake or break these terms.</li>
      <li>One person, one account. Don't create accounts for others or share your sign-in.</li>
      <li>You are responsible for everything done from your account. Keep your password private.</li>
    </ul>

    <h2 id="guidelines">Community guidelines</h2>
    <ul>
      <li><strong>Be real.</strong> No fake profiles, impersonation, fake reviews, or misleading professions, rates or photos.</li>
      <li><strong>Be respectful.</strong> No harassment, bullying, threats, hate speech or discrimination based on religion, caste, gender, disability or anything else.</li>
      <li><strong>No sexual content</strong> or unwanted advances. ProfileHUB is for work, services and trading, not dating.</li>
      <li><strong>No spam.</strong> No mass messages, chain messages, unsolicited promotions or repeated invitations to people who ignore you.</li>
      <li><strong>No scams or fraud,</strong> including fake jobs, advance-fee requests, phishing links or fake payment screenshots.</li>
      <li><strong>Nothing illegal.</strong> Follow the law of the place you live and work.</li>
    </ul>

    <h2 id="misuse">Misusing profiles and data</h2>
    <div class="callout callout--danger">
      <TriangleAlert />
      <p>
        <strong>Other members' information is not yours to reuse.</strong> Using it for anything other than the reason it was shared
        is misuse, and can lead to permanent removal and, where the law is broken, a report to the authorities.
      </p>
    </div>
    <ul>
      <li>Don't copy, scrape, collect or export members' names, photos, phone numbers, emails or addresses.</li>
      <li>Use contact details only to talk about the work or deal they were shared for. Never add people to marketing lists, groups or broadcasts without permission.</li>
      <li>Don't share screenshots of private chats, or anyone's contact details, location or photos, outside ProfileHUB without their consent.</li>
      <li>Don't use someone's photos or profile to create another account, or pretend to be a business you don't represent.</li>
      <li>Don't track, follow or show up at someone's location uninvited. Distances are shown to help you hire and trade nearby, nothing else.</li>
      <li>Don't use ProfileHUB to collect information about people for loans, recovery agents, background checks or surveillance.</li>
    </ul>

    <h2 id="chat">Chatting</h2>
    <ul>
      <li>Keep conversations about work, services or the item being sold.</li>
      <li>If someone isn't interested, stop messaging them. Anyone can <strong>block</strong> you from their profile or chat.</li>
      <li>Never ask anyone for OTPs, passwords, PINs, card or bank details, Aadhaar or PAN numbers.</li>
      <li>Don't send links to unknown apps, "verification" pages or payment requests.</li>
      <li>Only send photos you have the right to share. Never send intimate, violent or other people's private photos.</li>
    </ul>

    <h2 id="reviews">Reviews</h2>
    <ul>
      <li>Only review people you have actually worked with, hired, bought from or sold to, and describe your own experience.</li>
      <li>Don't offer or ask for money, discounts or favours in exchange for reviews, and don't review yourself through another account.</li>
      <li>Fake, abusive or threatening reviews are removed, and the accounts behind them can be suspended.</li>
    </ul>

    <h2 id="market">Marketplace rules</h2>
    <ul>
      <li>Only list things you own and are allowed to sell, with honest photos, condition and price.</li>
      <li>
        Not allowed: weapons, drugs, alcohol and tobacco, prescription medicines, stolen or counterfeit goods, wild or protected
        animals, adult content, government IDs or documents, and anything else that is illegal to sell.
      </li>
      <li>Mark items as sold when they are gone, and don't repost the same item again and again.</li>
    </ul>

    <h2 id="work">Hiring and work</h2>
    <ul>
      <li>Never charge anyone a fee to apply for, or to get, a job.</li>
      <li>Pay fairly and on time, and agree the work and the rate before it starts.</li>
      <li>Child labour, forced labour and unsafe work are illegal and will be reported.</li>
    </ul>

    <h2 id="safety">Safety tips</h2>
    <div class="callout">
      <ShieldAlert />
      <p>
        <strong>ProfileHUB will never ask for your password or an OTP.</strong> Anyone who does, even if they claim to be from
        ProfileHUB, a bank or a delivery company, is trying to scam you.
      </p>
    </div>
    <h3>When chatting</h3>
    <ul>
      <li>Never share OTPs, passwords, UPI PINs, card numbers, CVVs or bank details.</li>
      <li>Remember: you <strong>never</strong> need to enter a UPI PIN to <strong>receive</strong> money. A request that asks for your PIN is a payment out of your account.</li>
      <li>Be careful with links, QR codes and apps sent by people you don't know.</li>
      <li>Move to phone calls only when you are comfortable, and don't share your home address until you trust the person.</li>
    </ul>
    <h3>When buying or selling</h3>
    <ul>
      <li>Don't pay an advance to people you haven't met; see the item first, then pay.</li>
      <li>Meet in a busy public place in daylight and bring a friend for expensive items.</li>
      <li>Check papers for vehicles and electronics (registration, invoices, IMEI) before paying.</li>
    </ul>
    <h3>When hiring or working</h3>
    <ul>
      <li>Check the profile, connections and past work before booking. A verified badge means the member is on a paid plan, not that we have checked their identity.</li>
      <li>Agree the job, price and timing in chat so there is a record.</li>
      <li>Never hand over original ID documents or pay "registration" fees.</li>
    </ul>

    <h2 id="enforcement">What happens if rules are broken</h2>
    <p>Depending on how serious it is, admins may:</p>
    <ul>
      <li>warn you, or hide or delete the content (for example a listing), telling you why,</li>
      <li><strong>suspend</strong> your account, which signs you out and hides you from Discover and search,</li>
      <li><strong>permanently delete</strong> your account, and</li>
      <li>report threats, fraud, exploitation or other crimes to the police.</li>
    </ul>
    <p>You are emailed when your account is suspended or reactivated. Every admin action is recorded in an internal log, so decisions can be checked later.</p>

    <h2 id="plans">Plans</h2>
    <p>
      Every member starts on the free plan. Paid plans are requested from the Plans page and set up by an admin; their features,
      prices and limits are shown on that page and may change. When a plan ends you return to the free plan, and listings above
      the free limit stay but can't be reactivated until you are within it again.
    </p>

    <h2 id="liability">Our role and liability</h2>
    <p>
      ProfileHUB helps members find each other. We are not a party to the jobs, services or sales arranged here and don't guarantee
      any member, item or payment. Use your judgement and follow the safety tips above.
    </p>

    <h2 id="contact">Reporting and contact</h2>
    <ul>
      <li>
        <strong>Report</strong> a profile, listing or conversation from its menu (the flag or "⋯" button). Reports are private: the
        member isn't told who reported them. Admins review every report.
      </li>
      <li><strong>Block</strong> a member to stop all contact both ways; you can unblock them later in Settings.</li>
      <li>
        For anything else, or misuse of your information outside ProfileHUB, email
        <a :href="`mailto:${SUPPORT_EMAIL}`">{{ SUPPORT_EMAIL }}</a> with the member's name and what happened.
      </li>
    </ul>
    <p>See our <RouterLink to="/privacy">Privacy policy</RouterLink> for how we handle your data.</p>
  </LegalPage>
</template>
