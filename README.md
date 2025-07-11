# 🧠 AI-Powered Order Management System

https://github.com/user-attachments/assets/b9cf9563-8fb5-4c46-a941-bfff2645fcfb

An AI-driven internal tool that transforms how teams interact with order data—built from scratch using Next.js, OpenAI, and Pinecone.

This project demonstrates intelligent query handling, hybrid search, and a production-ready architecture for real-time operational use.

---

## 🧩 Key Features

### 💬 Natural Language Order Search
- Chat-based UI that understands queries like:
  - “What’s the status of order 20831?”
  - “Show all rush jobs from last week”
  - “Find all orders for customer LTH”
- Maintains context across interactions
- Displays structured results with enhanced formatting

### 🔍 Semantic Search + API Integration
- Pinecone vector DB with OpenAI embeddings enables semantic retrieval across historical order data
- Intelligent query router chooses between:
  - Direct live API calls (for exact lookups)
  - Vector search (for fuzzy or exploratory queries)
- Supports both real-time and cached retrieval for performance

### 🔄 Automated Data Pipeline
- OMS data is pulled via API and indexed with OpenAI embeddings
- Incremental updates handled via cron jobs or background tasks
- Handles deduplication and vector syncing

### 🧱 Built for Scalability
- Frontend: Next.js (App Router), React, Tailwind, shadcn/ui
- API logic: Node.js with structured fetch pipelines
- Semantic engine: OpenAI + Pinecone
- Designed for production use: error handling, rate limiting, health checks, environment configs

---

## 🧪 Current Stage

- Functional prototype with working query routing and blurred order data for privacy
- Ideal for internal use by logistics, ops, or manufacturing teams
- Built entirely solo in under one week

---

## 📌 Purpose

This project was built to explore how modern LLMs and vector databases can streamline internal business processes.  
It combines semantic search, real-time data access, and conversational UX into one lightweight system.

Great for showcasing:
- Full-stack AI system design
- Practical use of LLMs and embeddings
- Real-world integration with operational APIs
