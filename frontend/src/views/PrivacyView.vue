<script setup>
import { ShieldAlert } from 'lucide-vue-next';
import LegalPage from '@/components/LegalPage.vue';
import { SUPPORT_EMAIL } from '@/constants/legal';

const sections = [
  { id: 'collect', label: 'What we collect' },
  { id: 'visibility', label: 'Who can see what' },
  { id: 'location', label: 'Your location' },
  { id: 'messages', label: 'Messages' },
  { id: 'notifications', label: 'Emails and push notifications' },
  { id: 'reviews', label: 'Reviews and ratings' },
  { id: 'use', label: 'How we use your data' },
  { id: 'sharing', label: 'Sharing and third parties' },
  { id: 'storage', label: 'Cookies and browser storage' },
  { id: 'security', label: 'Security' },
  { id: 'choices', label: 'Your choices and deletion' },
  { id: 'age', label: 'Age requirement' },
  { id: 'changes', label: 'Changes and contact' },
];
</script>

<template>
  <LegalPage
    title="Privacy policy"
    intro="ProfileHUB helps you find professionals and buy and sell locally. This policy explains what we collect, who can see it, and the controls you have. In short: you decide what to share, your exact location is never shown to other members, and we never sell your data."
    :sections="sections"
  >
    <h2 id="collect">What we collect</h2>
    <ul>
      <li><strong>Account details:</strong> your name, sign-in email and password. Passwords are stored only as a secure hash; nobody, including admins, can read them. New accounts are reviewed by an admin before they can be used.</li>
      <li><strong>Sessions:</strong> for each sign-in, the browser and device name, IP address and when it was last used, so you can recognise and end sessions.</li>
      <li><strong>Reports and blocks:</strong> reports you send or that are made about you, and the members you block.</li>
      <li><strong>Profile:</strong> profession, role, headline, bio, skills, experience, rate, availability, city and profile photo. Photos are cropped and re-encoded on our server.</li>
      <li><strong>Contact details (optional):</strong> contact email, mobile number and address, if you add them in Settings.</li>
      <li><strong>Location (optional):</strong> only if you turn on location sharing or pin a listing on the map. See <a href="#location">Your location</a>.</li>
      <li><strong>Activity:</strong> connections and invitations, messages, marketplace listings and photos, notifications, profession and plan requests, and when you were last online.</li>
      <li><strong>Plan:</strong> which membership plan you are on and when it ends.</li>
    </ul>

    <h2 id="visibility">Who can see what</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Information</th><th>Who can see it</th></tr>
        </thead>
        <tbody>
          <tr><td>Name, photo, profession, role, headline, bio, skills, rate, city</td><td>All signed-in members (unless you hide yourself from Discover, people can still open your profile by link)</td></tr>
          <tr><td>Contact email, mobile, address</td><td>Only you and your connections. If your plan includes "Public contact details", all members.</td></tr>
          <tr><td>Exact location and full address of your pin</td><td>Only you. Others see your city and a rounded distance.</td></tr>
          <tr><td>Online status and last seen</td><td>Members, unless you turn off "Show online status"</td></tr>
          <tr><td>Messages</td><td>You and the person you are chatting with</td></tr>
          <tr><td>Listings and their photos</td><td>All members; the item location is shown only as an area and distance</td></tr>
          <tr><td>Sign-in email, plan, account status</td><td>You and ProfileHUB admins</td></tr>
        </tbody>
      </table>
    </div>

    <h2 id="location">Your location</h2>
    <p>
      Location sharing is <strong>off by default</strong>. When you turn it on, your browser asks for permission and we save your
      coordinates and a looked-up address so we can show distances and filter by range. Other members never receive your exact
      coordinates or address, only your city and a rounded distance such as "2.4 km away".
    </p>
    <p>
      Turning location sharing off <strong>deletes</strong> the saved coordinates and address details. A listing's map pin is only
      used to show buyers its area and distance.
    </p>

    <h2 id="messages">Messages</h2>
    <p>
      Messages are stored so they can be delivered and synced across your devices. We do not read your conversations, except when
      a member reports misuse and we need to investigate it, or when the law requires it. Deleting your account deletes the
      messages you sent and received.
    </p>
    <ul>
      <li>
        <strong>Photos in chat</strong> are re-saved by our server, which removes hidden details such as the GPS position a phone
        camera stores. Anyone with the link to a photo can open it, so only send photos you're comfortable sharing.
      </li>
      <li>
        <strong>Deleting a message</strong> removes its text and photos for both of you. <strong>Deleting a conversation</strong>
        hides it on your side only; the other member keeps their copy.
      </li>
      <li>You can edit a message for 15 minutes after sending it; edited messages are marked “edited”.</li>
    </ul>

    <h2 id="notifications">Emails and push notifications</h2>
    <p>
      We email you about your account (confirming your email address, password resets, approval, suspension) and, if you leave
      them on, about new messages, invitations, reviews and plan updates. Push notifications only reach a phone or computer after
      you turn them on there. You choose which emails and push notifications you get in Settings → Notifications. Emails are sent
      through our email provider (SendGrid), and push notifications through your browser's push service (for example Google or
      Apple), which only see the notification text.
    </p>

    <h2 id="reviews">Reviews and ratings</h2>
    <p>
      Members you are connected with, or who have chatted with you, can rate you from 1 to 5 stars and leave a comment. Reviews show
      on your profile with the reviewer's name. You can report a review that is fake or abusive; admins can remove it.
    </p>

    <h2 id="use">How we use your data</h2>
    <ul>
      <li>To run your account, show your profile and listings, and deliver messages and notifications.</li>
      <li>To recommend people near you and rank Discover and the Market.</li>
      <li>To apply your plan's features and handle your plan and profession requests.</li>
      <li>To keep ProfileHUB safe: detecting spam, scams and misuse, and enforcing our <RouterLink to="/terms">Terms &amp; community guidelines</RouterLink>.</li>
    </ul>
    <p>We do not sell your personal data and we do not show third-party advertising.</p>

    <h2 id="sharing">Sharing and third parties</h2>
    <ul>
      <li>
        <strong>Maps and address lookup:</strong> when you share your location, search for a place or use the map, your browser
        sends those coordinates or search words to OpenStreetMap services (Nominatim and map tiles) to look up the address and draw
        the map.
      </li>
      <li><strong>Email and push:</strong> SendGrid delivers our emails; your browser's push service delivers push notifications.</li>
      <li><strong>Legal requests:</strong> we may disclose information if required by law or to protect members from serious harm.</li>
    </ul>

    <h2 id="storage">Cookies and browser storage</h2>
    <p>
      We use one kind of cookie: a <strong>sign-in session cookie</strong>. It is marked httpOnly, so scripts on the page can't read
      it, and it is only sent to ProfileHUB. We do not use advertising or tracking cookies. Your browser also stores your theme, your
      Discover filters and which session each tab is using, so the app remembers your preferences.
    </p>

    <h2 id="security">Security</h2>
    <ul>
      <li>Passwords are stored only as a secure hash.</li>
      <li>
        Each sign-in is a session we can end at any time. Sessions close after 14 days without use and after 60 days at most. See and
        sign out any of them in <RouterLink to="/settings#sessions">Settings → Sessions &amp; data</RouterLink>.
      </li>
      <li>Changing your password signs you out on every other device; suspension signs you out everywhere.</li>
      <li>Sign-ups, sign-ins, messages, invitations, searches and uploads are rate limited to stop spam and password guessing.</li>
    </ul>
    <p>No system is perfectly secure, so use a strong password you don't use anywhere else and never share it.</p>

    <h2 id="choices">Your choices and deletion</h2>
    <ul>
      <li>Edit or remove any profile or contact detail in <RouterLink to="/settings">Settings</RouterLink>.</li>
      <li>Turn off location sharing, hide yourself from Discover, or hide your online status at any time.</li>
      <li>Block anyone from their profile or chat: neither of you can message or see each other.</li>
      <li>
        <strong>Download your data</strong> (profile, connections, messages, listings and requests) any time from
        <RouterLink to="/settings#sessions">Settings → Sessions &amp; data</RouterLink>.
      </li>
      <li>
        <strong>Delete your account</strong> in Settings. This permanently removes your profile, connections, messages, listings and
        photos. It cannot be undone.
      </li>
    </ul>

    <h2 id="age">Age requirement</h2>
    <p>You must be at least 18 years old to use ProfileHUB, because it is used for hiring and buying and selling.</p>

    <h2 id="changes">Changes and contact</h2>
    <p>
      If we change this policy we will update the date at the top. For privacy questions, data requests or to report misuse of your
      information, email <a :href="`mailto:${SUPPORT_EMAIL}`">{{ SUPPORT_EMAIL }}</a>.
    </p>
    <div class="callout">
      <ShieldAlert />
      <p>
        Someone misusing your photos, contact details or messages? Use <strong>Report</strong> on their profile, listing or chat, or
        email <a :href="`mailto:${SUPPORT_EMAIL}`">{{ SUPPORT_EMAIL }}</a>.
        Misuse breaks our <RouterLink to="/terms#misuse">guidelines</RouterLink> and can get the account suspended or deleted.
      </p>
    </div>
  </LegalPage>
</template>
