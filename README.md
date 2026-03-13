# 🎯 Enhanced Kanban View

A powerful custom Frappe app that extends Kanban view functionality with advanced features for better workflow management and data validation. **Inspired by Bitrix24's Kanban board system**.

## ✨ Features

### 🔗 Link Field-Based Kanban Boards
- Automatically creates columns based on Link fields in your DocTypes
- Auto-syncs columns when linked records are created, renamed, or deleted

### 📋 Column Rules & Validation
- Define required fields for specific columns
- Show validation dialogs when moving cards between columns
- Auto-revert cards if validation fails

### 🎨 Enhanced User Experience
- Quick Entry Dialogs with field validation
- Smart field detection for rules
- Seamless Frappe integration

## 🚀 Installation

```bash
bench get-app https://github.com/leadergroupsaudi/enhanced_kanban_view.git
bench --site your-site.com install-app enhanced_kanban_view
bench build
```

## 📖 Quick Start

### 1. Create Link Field-Based Kanban
1. Navigate to your DocType's List view
2. Click **Kanban** → **"New Kanban Board"**
3. Select your Link field
4. Columns auto-create based on linked records

### 2. Set Up Column Rules
1. Go to **Kanban View > Menu > Create Kanban Board Rule**
2. Choose target column
3. Add required fields in the **"Required Fields"** table

### 3. Validation Behavior
- Moving cards to columns with rules opens validation dialog
- Fill required fields to proceed
- Failed validation returns card to original position

## 🏗️ Architecture

### Core Components
- **Kanban Board Rule**: Defines validation rules for columns
- **Kanban Rule Field**: Child table for required fields
- **Monkey Patches**: Handle automatic column CRUD operations
- **API Endpoints**: Field validation and board configuration

### Database Schema
```json
Kanban Board Rule: {
  "kanban_board": "Link to Kanban Board",
  "kanban_board_column": "Link to Kanban Board Column", 
  "required_fields": "Table: Kanban Rule Field"
}

Kanban Rule Field: {
  "field_doctype": "Select: DocField|Custom Field",
  "field_name": "Select: Available Fields"
}
```

## 🔧 Configuration

- **Hooks**: CSS/JS, Monkey Patches, Document Events
- **Permissions**: System Manager access by default
- **Customization**: Standard and Custom Field support

## 🐛 Troubleshooting

### Common Issues
- **Columns not updating**: Check linked DocType permissions and Link field config
- **Validation dialogs missing**: Verify Kanban Board Rules configuration
- **Performance issues**: Monitor database queries and consider indexing

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes and test
4. Submit pull request

## 📄 License

MIT License - see [LICENSE](license.txt)

## 🙏 Acknowledgments

- **Bitrix24** - Design inspiration
- Frappe Framework team
- All contributors

**Made with ❤️ for the Frappe/ERPNext community**
