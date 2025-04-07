# Attendance Tracker Backend

This repository contains the backend for the **Attendance Tracker Bot Dashboard**, a system designed to manage and track attendance within a Discord server. The backend is tailored to handle intricate logic, provide APIs for the frontend, and ensure seamless communication between components.

## Features

### 1. **User Authentication and Authorization**
- **Functionality**: Manages user authentication and role-based access control within the Discord server.
- **How it works**: 
    - Integrates with Discord's OAuth2 for secure user authentication.
    - Middleware ensures only authorized users (e.g., Admins) can access specific commands and endpoints.
    - Role-based permissions are enforced to control access to bot commands and features.

### 2. **Attendance Tracking**
- **Functionality**: Tracks attendance for events based on a selected Discord role.
- **How it works**:
    - Users with a specific role can mark their attendance for events.
    - APIs validate attendance data to prevent duplicates or invalid entries.
    - Supports batch updates for managing attendance efficiently.

### 3. **Event Management**
- **Functionality**: Allows admins to create and manage events for specific games.
- **How it works**:
    - Admins can use the `/create-event` command to define event details (e.g., game, time, participants).
    - Events are stored in the database and linked to the Discord server.
    - APIs provide event data to the frontend for visualization and management.

### 4. **Preset Management**
- **Functionality**: Enables admins to create reusable presets for event parties.
- **How it works**:
    - Admins can use the `/create-preset` command to define party configurations (e.g., roles, size).
    - Presets are stored for quick reuse when creating new events.
    - APIs allow the frontend to fetch and display available presets.

### 5. **Integration with Frontend**
- **Functionality**: Provides RESTful APIs for the bot-dashboard frontend.
- **How it works**:
    - Endpoints handle requests from the frontend for event, attendance, and preset data.
    - JSON responses ensure compatibility with the frontend's data handling.
    - Real-time updates via WebSockets (if implemented) keep the frontend synchronized.

### 6. **Reporting and Analytics**
- **Functionality**: Generates reports and visualizes attendance trends.
- **How it works**:
    - APIs aggregate data for charts and graphs displayed on the frontend.
    - Supports exporting reports in formats like CSV or PDF.
    - Filters for date ranges, events, and user roles.

### 7. **Notifications**
- **Functionality**: Sends reminders and updates to Discord users.
- **How it works**:
    - Notifications are sent via Discord messages for upcoming events or missed attendance.
    - Configurable notification settings allow admins to customize reminders.

### 8. **Database Management**
- **Functionality**: Stores and retrieves all application data.
- **How it works**:
    - Uses a relational database (e.g., PostgreSQL, MySQL) for structured data storage.
    - Optimized queries ensure performance and scalability.
    - Regular backups maintain data integrity.

## How It Works Together with the Frontend
1. **API Communication**: The frontend communicates with the backend via RESTful APIs to fetch and send data.
2. **Authentication**: The frontend uses tokens provided by the backend to authenticate users and manage sessions.
3. **Real-Time Updates**: If WebSockets are implemented, the backend pushes updates to the frontend for real-time data synchronization.
4. **Data Visualization**: The backend processes raw data and sends it to the frontend for rendering charts, tables, and reports.

## Setup Instructions
1. Clone the repository:
     ```bash
     git clone https://github.com/your-username/attendance-tracker-backend.git
     ```
2. Install dependencies:
     ```bash
     npm install
     ```
3. Configure environment variables:
     - Create a `.env` file and add the required variables (e.g., database URL, Discord bot token, JWT secret).
4. Run migrations to set up the database:
     ```bash
     npm run migrate
     ```
5. Start the server:
     ```bash
     npm start
     ```

## API Documentation
Refer to the [API Documentation](./API_DOCS.md) for detailed information about available endpoints, request/response formats, and examples.

## Contributing
Contributions are welcome! Please follow the [contribution guidelines](./CONTRIBUTING.md).

## License
This project is licensed under the [MIT License](./LICENSE).
