/**
 * Sweet Athena Chat Component (Simple)
 * 
 * Simple chat interface for Sweet Athena demo.
 * 
 * @fileoverview Simple chat interface component
 * @author Sweet Athena Development Team
 * @version 1.0.0
 */

import React from 'react';
import { SimpleChatComponent } from './SimpleChatComponent';
import type { SimpleChatProps } from './SimpleChatComponent';

// Re-export the simple chat component as SweetAthenaChat
export const SweetAthenaChat = SimpleChatComponent;
export type SweetAthenaChatProps = SimpleChatProps;

export default SweetAthenaChat;