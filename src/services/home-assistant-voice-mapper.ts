/**
 * Home Assistant Voice Command Mapper
 * Maps natural language voice commands to Home Assistant actions
 */

import { homeAssistantService, HACommand } from './home-assistant-service';
import { logger } from '../utils/logger';

interface VoiceIntent {
  action: string;
  target?: string;
  value?: any;
  location?: string;
  attributes?: Record<string, any>;
}

export class HomeAssistantVoiceMapper {
  // Command patterns for different actions
  private readonly commandPatterns = {
    turnOn: [
      /turn on (?:the )?(.+)/i,
      /switch on (?:the )?(.+)/i,
      /enable (?:the )?(.+)/i,
      /activate (?:the )?(.+)/i,
      /start (?:the )?(.+)/i
    ],
    turnOff: [
      /turn off (?:the )?(.+)/i,
      /switch off (?:the )?(.+)/i,
      /disable (?:the )?(.+)/i,
      /deactivate (?:the )?(.+)/i,
      /stop (?:the )?(.+)/i
    ],
    toggle: [
      /toggle (?:the )?(.+)/i,
      /switch (?:the )?(.+)/i
    ],
    setBrightness: [
      /(?:set|dim|brighten) (?:the )?(.+?) (?:to |at )?(\d+)(?:%| percent)?/i,
      /(?:make|turn) (?:the )?(.+?) (\d+)(?:%| percent)(?: bright)?/i,
      /(.+?) (?:brightness|bright) (?:to |at )?(\d+)(?:%| percent)?/i
    ],
    setTemperature: [
      /set (?:the )?(?:temperature|temp|thermostat|heat|cooling|ac) (?:to |at )?(\d+)(?: degrees)?/i,
      /(?:make it|set it to) (\d+)(?: degrees)?/i,
      /(?:heat|cool) (?:to |at )?(\d+)(?: degrees)?/i
    ],
    increase: [
      /(?:increase|raise|turn up|brighten) (?:the )?(.+?)(?: by (\d+))?/i,
      /(?:make|turn) (?:the )?(.+?) (?:brighter|warmer|louder)/i
    ],
    decrease: [
      /(?:decrease|lower|turn down|dim) (?:the )?(.+?)(?: by (\d+))?/i,
      /(?:make|turn) (?:the )?(.+?) (?:dimmer|cooler|quieter)/i
    ],
    lock: [
      /lock (?:the )?(.+)/i,
      /secure (?:the )?(.+)/i
    ],
    unlock: [
      /unlock (?:the )?(.+)/i,
      /open (?:the )?(.+)/i
    ],
    scene: [
      /(?:activate|set|run|execute) (?:the )?(.+?) scene/i,
      /scene (.+)/i,
      /(?:good night|goodnight|good morning|movie time|dinner time|party mode)/i
    ],
    automation: [
      /(?:run|trigger|execute) (?:the )?(.+?) automation/i,
      /automation (.+)/i
    ],
    query: [
      /(?:what's|what is|tell me) (?:the )?(.+)/i,
      /(?:is|are) (?:the )?(.+?) (?:on|off|open|closed|locked|unlocked)/i,
      /(?:check|status of) (?:the )?(.+)/i
    ]
  };

  // Room aliases
  private readonly roomAliases: Record<string, string[]> = {
    'living_room': ['living room', 'lounge', 'tv room', 'family room'],
    'bedroom': ['bedroom', 'master bedroom', 'bed room'],
    'kitchen': ['kitchen', 'cooking area'],
    'bathroom': ['bathroom', 'bath', 'restroom', 'washroom'],
    'office': ['office', 'study', 'work room', 'desk'],
    'garage': ['garage', 'car port'],
    'hallway': ['hallway', 'hall', 'corridor'],
    'basement': ['basement', 'downstairs', 'cellar'],
    'attic': ['attic', 'upstairs', 'loft']
  };

  // Device type aliases
  private readonly deviceAliases: Record<string, string[]> = {
    'light': ['light', 'lights', 'lamp', 'lamps', 'bulb', 'bulbs', 'lighting'],
    'switch': ['switch', 'outlet', 'plug', 'socket'],
    'fan': ['fan', 'ventilator', 'air'],
    'door': ['door', 'doors', 'entrance', 'exit'],
    'window': ['window', 'windows'],
    'blind': ['blind', 'blinds', 'shade', 'shades', 'curtain', 'curtains'],
    'lock': ['lock', 'locks', 'deadbolt'],
    'thermostat': ['thermostat', 'temperature', 'heating', 'cooling', 'ac', 'air conditioning', 'heat'],
    'tv': ['tv', 'television', 'display', 'screen'],
    'speaker': ['speaker', 'speakers', 'audio', 'music', 'sound'],
    'camera': ['camera', 'cameras', 'cam', 'security']
  };

  /**
   * Parse voice command and extract intent
   */
  parseVoiceCommand(command: string): VoiceIntent | null {
    const lowerCommand = command.toLowerCase().trim();

    // Check for turn on commands
    for (const pattern of this.commandPatterns.turnOn) {
      const match = lowerCommand.match(pattern);
      if (match) {
        return {
          action: 'turn_on',
          target: this.normalizeTarget(match[1] || 'unknown')
        };
      }
    }

    // Check for turn off commands
    for (const pattern of this.commandPatterns.turnOff) {
      const match = lowerCommand.match(pattern);
      if (match) {
        return {
          action: 'turn_off',
          target: this.normalizeTarget(match[1] || 'unknown')
        };
      }
    }

    // Check for toggle commands
    for (const pattern of this.commandPatterns.toggle) {
      const match = lowerCommand.match(pattern);
      if (match) {
        return {
          action: 'toggle',
          target: this.normalizeTarget(match[1] || 'unknown')
        };
      }
    }

    // Check for brightness commands
    for (const pattern of this.commandPatterns.setBrightness) {
      const match = lowerCommand.match(pattern);
      if (match) {
        return {
          action: 'set',
          target: this.normalizeTarget(match[1] || 'unknown'),
          value: parseInt(match[2] || '0'),
          attributes: { brightness: true }
        };
      }
    }

    // Check for temperature commands
    for (const pattern of this.commandPatterns.setTemperature) {
      const match = lowerCommand.match(pattern);
      if (match) {
        return {
          action: 'set',
          target: 'climate',
          value: parseInt(match[1] || '0'),
          attributes: { temperature: true }
        };
      }
    }

    // Check for increase commands
    for (const pattern of this.commandPatterns.increase) {
      const match = lowerCommand.match(pattern);
      if (match) {
        return {
          action: 'increase',
          target: this.normalizeTarget(match[1] || 'unknown'),
          value: match[2] ? parseInt(match[2]) : 10
        };
      }
    }

    // Check for decrease commands
    for (const pattern of this.commandPatterns.decrease) {
      const match = lowerCommand.match(pattern);
      if (match) {
        return {
          action: 'decrease',
          target: this.normalizeTarget(match[1] || 'unknown'),
          value: match[2] ? parseInt(match[2]) : 10
        };
      }
    }

    // Check for lock commands
    for (const pattern of this.commandPatterns.lock) {
      const match = lowerCommand.match(pattern);
      if (match) {
        return {
          action: 'turn_on',
          target: this.normalizeTarget(match[1] || 'unknown', 'lock')
        };
      }
    }

    // Check for unlock commands
    for (const pattern of this.commandPatterns.unlock) {
      const match = lowerCommand.match(pattern);
      if (match) {
        return {
          action: 'turn_off',
          target: this.normalizeTarget(match[1] || 'unknown', 'lock')
        };
      }
    }

    // Check for scene commands
    for (const pattern of this.commandPatterns.scene) {
      const match = lowerCommand.match(pattern);
      if (match) {
        return {
          action: 'scene',
          target: match[1] ? this.normalizeSceneName(match[1]) : this.detectSceneFromPhrase(lowerCommand)
        };
      }
    }

    // Check for special phrases that map to scenes
    if (lowerCommand.includes('good night') || lowerCommand.includes('goodnight')) {
      return { action: 'scene', target: 'goodnight' };
    }
    if (lowerCommand.includes('good morning')) {
      return { action: 'scene', target: 'morning' };
    }
    if (lowerCommand.includes('movie time')) {
      return { action: 'scene', target: 'movie' };
    }

    // Check for "all" commands
    if (lowerCommand.includes('all')) {
      if (lowerCommand.includes('lights')) {
        if (lowerCommand.includes('off')) {
          return { action: 'turn_off', target: 'group.all_lights' };
        }
        if (lowerCommand.includes('on')) {
          return { action: 'turn_on', target: 'group.all_lights' };
        }
      }
      if (lowerCommand.includes('doors') && lowerCommand.includes('lock')) {
        return { action: 'turn_on', target: 'group.all_locks' };
      }
    }

    return null;
  }

  /**
   * Normalize target name to entity ID format
   */
  private normalizeTarget(target: string, domain?: string): string {
    let normalized = target.toLowerCase().trim();

    // Check for room aliases
    for (const [canonical, aliases] of Object.entries(this.roomAliases)) {
      if (aliases.some(alias => normalized.includes(alias))) {
        normalized = normalized.replace(new RegExp(aliases.join('|'), 'gi'), canonical);
      }
    }

    // Check for device aliases
    for (const [canonical, aliases] of Object.entries(this.deviceAliases)) {
      if (aliases.some(alias => normalized.includes(alias))) {
        if (!domain) {
          domain = canonical;
        }
        normalized = normalized.replace(new RegExp(aliases.join('|'), 'gi'), canonical);
      }
    }

    // Convert spaces to underscores
    normalized = normalized.replace(/\s+/g, '_');

    // Add domain if not present
    if (domain && !normalized.includes('.')) {
      return `${domain}.${normalized}`;
    }

    // Try to infer domain from common patterns
    if (!normalized.includes('.')) {
      if (normalized.includes('light')) return `light.${normalized}`;
      if (normalized.includes('switch')) return `switch.${normalized}`;
      if (normalized.includes('fan')) return `fan.${normalized}`;
      if (normalized.includes('lock')) return `lock.${normalized}`;
      if (normalized.includes('door')) return `binary_sensor.${normalized}`;
      if (normalized.includes('motion')) return `binary_sensor.${normalized}`;
      if (normalized.includes('temperature')) return `climate.${normalized}`;
    }

    return normalized;
  }

  /**
   * Normalize scene name
   */
  private normalizeSceneName(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '_');
  }

  /**
   * Detect scene from common phrases
   */
  private detectSceneFromPhrase(phrase: string): string {
    if (phrase.includes('night') || phrase.includes('sleep') || phrase.includes('bed')) {
      return 'goodnight';
    }
    if (phrase.includes('morning') || phrase.includes('wake')) {
      return 'morning';
    }
    if (phrase.includes('movie') || phrase.includes('tv') || phrase.includes('watch')) {
      return 'movie';
    }
    if (phrase.includes('dinner') || phrase.includes('eat') || phrase.includes('meal')) {
      return 'dinner';
    }
    if (phrase.includes('party') || phrase.includes('guests')) {
      return 'party';
    }
    if (phrase.includes('work') || phrase.includes('focus')) {
      return 'work';
    }
    return 'default';
  }

  /**
   * Execute voice command through Home Assistant
   */
  async executeVoiceCommand(command: string): Promise<{
    success: boolean;
    message: string;
    action?: HACommand;
    result?: any;
  }> {
    try {
      // Parse the voice command
      const intent = this.parseVoiceCommand(command);
      
      if (!intent) {
        return {
          success: false,
          message: "I didn't understand that command. Try saying 'turn on the living room lights' or 'set temperature to 72 degrees'."
        };
      }

      logger.info('🎤 Parsed voice command', {
        command,
        intent,
        context: 'home-assistant-voice'
      });

      // Find matching device(s)
      let targetEntity: string | undefined;
      
      if (intent.target) {
        // First try exact match
        let device = homeAssistantService.getDevice(intent.target);
        
        // If no exact match, try to find by friendly name
        if (!device && intent.target) {
          const devices = homeAssistantService.getDevicesByDomain();
          for (const [domain, domainDevices] of devices) {
            for (const dev of domainDevices) {
              const friendlyName = dev.attributes.friendly_name?.toLowerCase();
              if (friendlyName && friendlyName.includes(intent.target.replace('_', ' '))) {
                device = dev;
                break;
              }
            }
            if (device) break;
          }
        }

        if (device) {
          targetEntity = device.entity_id;
        } else if (intent.target.includes('.')) {
          // Assume it's already an entity ID
          targetEntity = intent.target;
        }
      }

      // Create Home Assistant command
      const haCommand: HACommand = {
        action: intent.action as HACommand['action'],
        entity: targetEntity,
        value: intent.value,
        attributes: intent.attributes
      };

      // Execute the command
      const result = await homeAssistantService.executeCommand(haCommand);

      // Generate response message
      let message = '';
      switch (intent.action) {
        case 'turn_on':
          message = `Turned on ${intent.target}`;
          break;
        case 'turn_off':
          message = `Turned off ${intent.target}`;
          break;
        case 'toggle':
          message = `Toggled ${intent.target}`;
          break;
        case 'set':
          if (intent.attributes?.brightness) {
            message = `Set ${intent.target} brightness to ${intent.value}%`;
          } else if (intent.attributes?.temperature) {
            message = `Set temperature to ${intent.value} degrees`;
          } else {
            message = `Set ${intent.target} to ${intent.value}`;
          }
          break;
        case 'increase':
          message = `Increased ${intent.target} by ${intent.value}`;
          break;
        case 'decrease':
          message = `Decreased ${intent.target} by ${intent.value}`;
          break;
        case 'scene':
          message = `Activated ${intent.target} scene`;
          break;
        default:
          message = `Executed ${intent.action} on ${intent.target}`;
      }

      return {
        success: true,
        message,
        action: haCommand,
        result
      };
    } catch (error) {
      logger.error('Failed to execute voice command', {
        command,
        error: error instanceof Error ? error.message : 'Unknown error',
        context: 'home-assistant-voice'
      });

      return {
        success: false,
        message: `Failed to execute command: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get command suggestions based on available devices
   */
  getCommandSuggestions(): string[] {
    const suggestions: string[] = [];
    const devices = homeAssistantService.getDevicesByDomain();

    // Add device-specific suggestions
    for (const [domain, domainDevices] of devices) {
      if (domainDevices.length > 0) {
        const device = domainDevices[0];
        if (!device) continue;
        const name = device.attributes?.friendly_name || device.entity_id?.split('.')[1] || 'unknown';

        switch (domain) {
          case 'light':
            suggestions.push(`Turn on the ${name}`);
            suggestions.push(`Dim the ${name} to 50%`);
            break;
          case 'switch':
            suggestions.push(`Turn off the ${name}`);
            break;
          case 'climate':
            suggestions.push('Set temperature to 72 degrees');
            break;
          case 'lock':
            suggestions.push(`Lock the ${name}`);
            break;
          case 'cover':
            suggestions.push(`Open the ${name}`);
            suggestions.push(`Close the ${name}`);
            break;
        }
      }
    }

    // Add common commands
    suggestions.push('Turn off all lights');
    suggestions.push('Good night');
    suggestions.push('Good morning');
    suggestions.push('Lock all doors');

    return suggestions.slice(0, 10); // Return top 10 suggestions
  }
}

// Export singleton instance
export const homeAssistantVoiceMapper = new HomeAssistantVoiceMapper();