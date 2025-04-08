# Gripendor Bot Backend

## Overview

The Attendance Tracker Bot is a Discord bot designed to streamline event management, role tracking, and attendance tracking within a Discord server. It integrates with a PostgreSQL database to store and retrieve data, and it provides a seamless user experience through Discord commands, buttons, and modals. The bot also integrates with Cloudinary for image management and offers a customizable dashboard for server administrators.

---

## Features

### 1. **Role Management**
- Add roles to the database for use in party-making or event management.
- Prevent duplicate roles from being added.
- Provide feedback to users about which roles were added and which already exist.

### 2. **Event Management**
- Create events with details like name, date, description, and images.
- Store event data in the database and post event details in a configured channel.
- Allow users to RSVP for events using buttons (✅ for attending, ❌ for declining).
- Support event cancellation and debriefing via modals.

### 3. **Attendance Tracking**
- Track user attendance for events.
- Send reminders to users who RSVP'd "yes" for upcoming events.

### 4. **Preset Management**
- Create reusable presets for party configurations (e.g., roles and sizes).
- Store presets in the database for quick reuse.

### 5. **Image Management**
- Upload event-related images to Cloudinary.
- Delete images from Cloudinary when events are canceled.

### 6. **Notifications**
- Send reminders to users about upcoming events.
- Provide feedback to users about their actions (e.g., role addition, event creation).

---

## Commands and Interactions

### `/add-roles`
- **Description**: Add additional roles to the database for use in party-making.
- **Workflow**:
  1. User runs the `/add-roles` command and specifies up to 15 roles.
  2. Bot verifies if the user has the required admin role.
  3. For each role:
     - If the role already exists, it is added to the "existing roles" list.
     - If the role is new, it is added to the "added roles" list.
  4. Bot sends a response summarizing:
     - Roles successfully added.
     - Roles that already exist.

---

### `/create-event`
- **Description**: Create a new event with details like name, date, and images.
- **Workflow**:
  1. User runs the `/create-event` command and provides event details.
  2. Bot uploads provided images to Cloudinary.
  3. Event details, including Cloudinary image URLs, are stored in the database.
  4. Bot posts an embed message in a configured channel with event details.
  5. Embed includes buttons for users to RSVP:
     - ✅ to attend.
     - ❌ to decline. 
     - "Cancel Event" to cancel the event. 
     - "Finish Event" to complete the event.

---

### Event RSVP
- **Description**: Allow users to RSVP for events.
- **Workflow**:
  1. User clicks the ✅ or ❌ button on an event embed.
  2. Bot checks if the user has the required role to RSVP.
  3. User's response is stored in the database.
  4. Bot updates the event embed to reflect the updated attendance list.

---

### Event Cancellation
- **Description**: Cancel an event and remove it from the database.
- **Workflow**:
  1. Admin clicks the "Cancel Event" button on an event embed.
  2. Bot shows a modal asking the admin to type "CONFIRM" to cancel the event.
  3. If confirmed:
     - Bot retrieves the event's image URLs from the database.
     - Bot deletes the images from Cloudinary.
     - Event is removed from the database.
     - Event embed is deleted from the channel.
     - Admin receives a confirmation message.

---

### `/create-preset`
- **Description**: Create reusable presets for party configurations.
- **Workflow**:
  1. User runs the `/create-preset` command and provides details like party size, preset name, and roles.
  2. Bot validates the input (e.g., party size must be between 2 and 10).
  3. Bot shows a modal asking the user to specify the count for each role.
  4. Preset is stored in the database.
  5. User receives a confirmation message.

---

### Reminders for Upcoming Events
- **Description**: Notify users about upcoming events they RSVP'd for.
- **Workflow**:
  1. A cron job runs every minute to check for events happening within the next hour.
  2. For each event:
     - Bot retrieves the list of users who RSVP'd "yes."
     - Bot sends a reminder message to each user via DM.
     - Bot updates the database to mark the reminders as sent.

---

## Database Integration

### Tables
- **`roles`**: Stores roles added via the `/add-roles` command.
- **`events`**: Stores event details like name, date, and images.
- **`event_attendance`**: Tracks user attendance for events.
- **`presets`**: Stores reusable party configurations.
- **`users`**: Basic user info.
- **`guilds`**: Stores guild-specific configurations (e.g., admin role, default channel).
- **`guildusers`**: Stores users with any guilds they are a part of which run the bot.
- **`guilduserroles`**: Stores users with specific guilds and their roles, with boolean values to check if they hold said roles.


### Queries
- Insert, update, and retrieve data for roles, events, attendance, and presets.
- Prevent duplicate entries using `ON CONFLICT` clauses.

---

## Error Handling
- **Role Management**:
  - If a role already exists, the bot informs the user and skips adding it.
- **Event Management**:
  - If an event fails to create, the bot sends an error message to the user.
- **Image Management**:
  - If an image fails to upload or delete, the bot logs the error and informs the user.
- **Database Errors**:
  - If a database query fails, the bot logs the error and sends a generic error message to the user.

---

## External Integrations

### Cloudinary
- Used for uploading and managing event-related images.
- Images are deleted when events are canceled.

### PostgreSQL
- Used for storing and retrieving data related to roles, events, attendance, and presets.

### Discord.js
- Used for interacting with the Discord API to handle commands, buttons, modals, and embeds.

---

## User Feedback
- The bot provides detailed feedback for every action:
  - Success messages for added roles, created events, and saved presets.
  - Error messages for invalid inputs or failed operations.
  - Confirmation messages for actions like event cancellation and debriefing.

---

## Security
- **JWT Authentication**:
  - Used for securing API endpoints.
  - Tokens expire after 1 hour to ensure session security.
- **Password Hashing**:
  - Admin passwords are hashed using bcrypt before being stored in the database.

---

## Future Enhancements
- Add support for recurring events.
- Implement advanced analytics for event attendance.
- Allow users to customize reminder intervals.

---

This README provides a comprehensive overview of the bot's functionality, interactions, and architecture. For further details, refer to the source code or contact the project maintainer.