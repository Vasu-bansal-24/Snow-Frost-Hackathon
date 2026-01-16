# Consent Tracker Browser Extension 🔒

A privacy-focused browser extension that tracks, monitors, and logs user consent actions across websites, including cookie acceptance, newsletter subscriptions, browser permissions, and more. Built with blockchain integration for immutable consent records.

## 🌟 Features

### Core Functionality
- **Automatic Consent Detection**: Intelligently monitors and logs consent actions across web pages
- **Browser Permission Tracking**: Captures and records browser API permission requests (location, notifications, camera, microphone, etc.)
- **Smart Categorization**: Automatically categorizes consents into:
  - 🍪 Cookies
  - 📧 Newsletter/Email
  - 👤 Account/Registration
  - 📊 Data Sharing
  - 📜 Terms & Conditions
  - 🔔 Notifications
  - 📍 Location
  - 🔐 Permissions
  - 📢 Marketing

### Dashboard & Analytics
- **Comprehensive Dashboard**: View all tracked consents with filtering and search capabilities
- **Privacy Risk Assessment**: Real-time privacy risk level indicator
- **Statistics & Insights**: Track consent trends by date, category, and website
- **Visual Feedback**: On-page notifications when consent actions are detected

### Data Management
- **Export Options**: Export consent records in JSON or CSV format
- **Search & Filter**: Advanced filtering by date, category, and website
- **Clear History**: Option to remove all tracked consents

### Blockchain Integration
- **Immutable Records**: Anchor consent data to blockchain for tamper-proof verification
- **Proof Generation**: Create cryptographic hashes for each consent action
- **Simulated Mode**: Test blockchain features without real transactions
- **Smart Contract Integration**: Store consent proofs on-chain using Solidity contracts

## 🛠️ Technology Stack

- **Languages**: JavaScript (51.4%), HTML (23.6%), CSS (19.7%), Solidity (5.3%)
- **Browser APIs**: Chrome Extension API, Web Crypto API
- **Blockchain**: Ethereum/EVM-compatible networks
- **Storage**: Chrome Local Storage

## 📁 Project Structure

```
├── manifest.json           # Extension configuration
├── popup.html/js/css       # Extension popup interface
├── dashboard.html/js/css   # Full dashboard view
├── content.js              # Content script for page monitoring
├── background.js           # Background service worker
├── inject.js               # Page context script for API interception
├── blockchain.js           # Blockchain integration service
├── chatbot-widget.*        # AI chatbot interface (optional)
├── options.html/js         # Extension settings page
├── contracts/              # Solidity smart contracts
├── icons/                  # Extension icons
└── lib/                    # External libraries
```

## 🚀 Installation

### From Source

1. Clone the repository:
```bash
git clone https://github.com/Vasu-bansal-24/Snow-Frost-Hackathon.git
cd Snow-Frost-Hackathon
```

2. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the project directory

3. The extension icon should appear in your browser toolbar

## 💡 Usage

### Basic Usage

1. **Click the extension icon** to view the popup with:
   - Total consent count
   - Number of unique sites
   - Today's consent count
   - Privacy risk level
   - Recent consent activity

2. **Browse the web** - The extension automatically detects and logs:
   - Cookie consent banners
   - Newsletter subscriptions
   - Browser permission requests
   - Form submissions with consent implications
   - Terms & conditions acceptance

3. **Open the Dashboard** - Click "Open Dashboard" for:
   - Complete consent history
   - Advanced filtering and search
   - Statistics and analytics
   - Export functionality
   - Blockchain verification status

### Blockchain Features

To enable blockchain anchoring:

1. Configure your blockchain settings in the extension options
2. Set your preferred network (Ethereum, Polygon, etc.)
3. Enable automatic anchoring or manually anchor consent batches
4. View transaction hashes and verification status in the dashboard

## 🔧 Configuration

Access extension settings via the options page:
- Configure blockchain network settings
- Set smart contract addresses
- Enable/disable automatic anchoring
- Configure API keys (for AI chatbot feature)

## 📊 Privacy & Security

- **Local Storage**: All consent data is stored locally in your browser
- **No Tracking**: The extension does not send data to external servers
- **Cryptographic Hashing**: Each consent generates a unique hash for verification
- **Blockchain Verification**: Optional immutable proof of consent on blockchain
- **User Control**: Full control over data with export and clear options

## 🤝 Contributing

This project was created for the Snow Frost Hackathon. Contributions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is open source and available for hackathon demonstration purposes.

## 🏆 Hackathon

Created for the **Snow Frost Hackathon** - A privacy-focused consent tracking solution with blockchain integration.

## 👥 Authors

- Vasu Bansal ([@Vasu-bansal-24](https://github.com/Vasu-bansal-24))

## 🐛 Known Issues & Future Enhancements

- [ ] Add support for Firefox and other browsers
- [ ] Implement consent withdrawal tracking
- [ ] Add GDPR compliance reports
- [ ] Enhance AI-powered consent analysis
- [ ] Multi-language support
- [ ] Cloud backup options (with encryption)

## 📧 Contact

For questions or feedback, please open an issue in the GitHub repository.

---

**Note**: This extension is designed to help users track their own consent actions for privacy awareness. It does not interfere with website functionality or automatically accept/reject consents on behalf of the user.
