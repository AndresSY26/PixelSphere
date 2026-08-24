# **App Name**: PixelSphere

## Core Features:

- User Authentication & Profiles: Secure user registration and login functionality, enabling personalized media management.
- Media Upload & Basic Processing: Allow users to upload various media types. Extract basic metadata (like EXIF data) during the upload process for organization.
- AI Media Auto-Tagging: A tool that uses generative AI (Google Gemini via Genkit) to analyze uploaded media, automatically generating relevant tags and descriptions to improve searchability.
- Dynamic Media Gallery: Display uploaded media in an interactive, responsive grid with capabilities for infinite scrolling, basic filtering by resolution and type, and semantic search.
- Album Creation & Management: Enable users to create custom albums, manually arrange media, select album covers, and manage basic visibility settings.
- AI-Enhanced Editing Toolkit: A tool for generative editing of media content based on natural language prompts, leveraging AI (Google Gemini via Genkit). Includes basic manual editing like cropping and rotation.
- JSON File Persistence: Robust system for storing all application data (user information, media metadata, album structures) within structured JSON files on the server, as specified.

## Style Guidelines:

- Color scheme: Dark. Appropriate for a professional multimedia platform, reducing eye strain and enhancing media visibility.
- Primary color: A sophisticated, luminous blue-violet (#7373F0). Chosen to evoke modernity, technology, and creativity while standing out against a dark background.
- Background color: A deep, muted blue-grey (#27272D). This subtle cool tone provides a stable and professional canvas that visually harmonizes with the primary color.
- Accent color: A vibrant cyan (#66E0FF). Selected to provide high contrast for interactive elements, highlights, and calls to action, adding a contemporary and energetic touch.
- Headline and Body text font: 'Inter' (sans-serif). A modern, objective, and highly legible font suitable for a technical and organized application, ensuring clear information hierarchy across the UI.
- Utilize Lucide Icons for all interface elements. Their clean lines and consistent style will maintain a high-end, component-based aesthetic.
- Implement responsive layouts (mobile-first approach) to ensure optimal viewing and interaction across all device sizes. Emphasize component-based UI consistent with high-fidelity design systems like ShadCN/Radix.
- Integrate smooth transitions and animations for state changes and navigation. Implement 'skeleton' loading states for data fetching to provide a polished user experience.