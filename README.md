# Wedding Registry

A simple web application for hosting a wedding registry that aggregates items from multiple online shops.

## Features

- **Unified Login System**: Single login page for all users
- **Multiple User Types**: Support for 3 user types (Family, Friends, Coworkers) plus Admin
- **Tag-based Filtering**: Each user type sees items tagged for them
- **Admin Interface**: Add, manage, and tag registry items
- **External Links**: Link to items on any online shop
- **Responsive Design**: Works on desktop and mobile devices

## User Types

1. **Admin**: Can add items, manage tags, and view all items
2. **Family**: Views items tagged as "family" or "all"
3. **Friends**: Views items tagged as "friends" or "all"
4. **Coworkers**: Views items tagged as "coworkers" or "all"

## Setup

### Prerequisites

- Node.js (version 14 or higher)
- npm

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd wedding-registry
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Default Accounts

The application comes with pre-configured demo accounts:

- **Admin**: 
  - Username: `admin`
  - Password: `admin123`

- **Family User**: 
  - Username: `family_user`
  - Password: `family123`

- **Friends User**: 
  - Username: `friends_user`
  - Password: `friends123`

- **Coworkers User**: 
  - Username: `coworkers_user`
  - Password: `coworkers123`

## Usage

### For Admin Users

1. Login with admin credentials
2. Use the admin panel to add new registry items:
   - Enter item name and URL (required)
   - Add description, shop name, and image URL (optional)
   - Select tags to control which user types can see the item
3. View and manage all registry items
4. Delete items as needed

### For Regular Users (Family, Friends, Coworkers)

1. Login with your credentials
2. View registry items tagged for your user type
3. Click on items to visit the shop website
4. Purchase items directly from the linked stores

## Technology Stack

- **Backend**: Node.js with Express
- **Database**: SQLite (better-sqlite3)
- **Authentication**: express-session with bcryptjs
- **Frontend**: HTML, CSS, JavaScript (Vanilla)

## Project Structure

```
wedding-registry/
├── server.js           # Main server application
├── package.json        # Node.js dependencies
├── registry.db         # SQLite database (created on first run)
└── public/             # Static files
    ├── index.html      # Redirect to login
    ├── login.html      # Login page
    ├── admin.html      # Admin interface
    ├── registry.html   # User registry view
    └── styles.css      # Styles
```

## Security Notes

- Change the session secret in `server.js` for production use
- Change default passwords before deploying
- Use HTTPS in production
- Consider adding rate limiting for login attempts

## License

ISC
