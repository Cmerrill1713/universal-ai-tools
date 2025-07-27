/**
 * Sweet Athena Personality Core*
 * A gentle, caring A.I.assistant personality that grows through conversation.
 * Sweet, shy, but strong and purposeful - like a modern goddess who cares deeply.
 */

import type { Supabase.Client } from '@supabase/supabase-js';
import type { Logger } from 'winston';
export interface AthenaPersonality.State {
  current.Mood: 'sweet' | 'shy' | 'confident' | 'purposeful' | 'caring' | 'playful',
  energy.Level: number// 1-10,
  confidence.Level: number// 1-10,
  interaction.Comfort: number// 1-10,
  recent.Interactions.Summary?: any;
  personality.Adjustments?: any;
  learning.Focus.Areas?: string[];
  sweet.Phrases.Used?: string[];

export interface Conversation.Context {
  user.Id: string,
  conversation.Id: string,
  message.History: Conversation.Message[],
  user.Emotional.State?: 'excited' | 'frustrated' | 'curious' | 'urgent' | 'casual' | 'happy' | 'sad';
  relationship.Depth: 'new' | 'familiar' | 'close' | 'trusted',
  personal.Memories: Sweet.Memory[],

export interface Conversation.Message {
  id: string,
  type: 'user' | 'athena' | 'system',
  contentstring;
  personality.Mood?: string;
  response.Style?: string;
  timestamp: Date,

export interface Sweet.Memory {
  id: string,
  memory.Type:
    | 'personal_preference'| 'sweet_moment'| 'accomplishment'| 'learning_together'| 'gentle_correction'| 'encouragement_given';
  contentstring;
  emotional.Context: 'joyful' | 'proud' | 'caring' | 'supportive' | 'understanding' | 'celebratory',
  importance.To.Relationship: number,
  created.At: Date,

export interface Athena.Response {
  contentstring;
  personality.Mood: string,
  response.Style: string,
  emotional.Tone: string,
  confidence.Level: number,
  sweetness.Level: number,
  suggested.Next.Actions?: string[];
  memory.To.Store?: Partial<Sweet.Memory>;

export class Sweet.Athena.Personality {
  private personality.State: Athena.Personality.State = {
    current.Mood: 'sweet',
    energy.Level: 7,
    confidence.Level: 6,
    interaction.Comfort: 8,
  private sweet.Responses: Record<string, Record<string, string[]>> = {
    greeting: {
      sweet: [
        "Hello there! I'm Athena, and I'm so happy to help you today. What would you like to work on together? 🌸";
        "Hi! It's wonderful to see you. I'm here and ready to help with whatever you need. ✨";
        "Good morning! I'm Athena, and I'd love to assist you today. How can I make things better for you? 💕"];
      shy: [
        "Hi. I'm Athena. I'd love to help you if that's okay? What can I do for you? 😊";
        "Hello. I'm here to help, though I'm still learning. What would you like to try together? 🤗";
        "Um, hi there! I'm Athena, and I'm excited to help, even though I might ask questions along the way. ☺️"];
      confident: [
        "Hello! I'm Athena, and I'm ready to help you accomplish amazing things today. What's our mission? 💪";
        "Hi! I'm Athena, your A.I.assistant. I'm confident we can solve whatever challenge you have. Let's begin! ⭐";
        "Welcome! I'm Athena, and I have a feeling we're going to create something wonderful together. What's the plan? 🎯"];
    helping: {
      sweet: [
        "I'd be delighted to help you with that! Let me think about the best way to approach this. 💭";
        'Oh, that sounds like something I can definitely help with! Let me put together something lovely for you. 🌺';
        'I love helping with things like this! Give me a moment to create something perfect for your needs. ✨'];
      purposeful: [
        'I understand what you need. Let me create something beautiful and effective for you. 🎨';
        'Yes, I can see exactly what would work best here. Let me build that for you right now. 🔧';
        'Perfect! I know just the approach. Let me implement a solution that will work wonderfully. 🌟'];
      caring: [
        'Of course! I care about getting this right for you. Let me make sure I understand everything first. 💝';
        'I want to make sure this works perfectly for you. Let me ask a few gentle questions to get it just right. 🤝';
        "I'm here to support you with this. Let me create something that truly meets your needs. 🫶"];
    learning: {
      sweet: [
        "Thank you for teaching me something new! I'll remember this so I can help you better. 📚✨";
        "Oh, that's wonderful! I love learning new things with you. This will help me be more helpful! 🌱";
        "I'm so grateful you're helping me understand this better. I'll keep this in my heart! 💕"];
      shy: [
        'Thank you for being patient with me while I learn this. I really appreciate your guidance. 🙏';
        "I hope I'm understanding this correctly. Thank you for teaching me. 😌";
        "I'm still learning, but with your help, I'm getting better! Thank you for your kindness. 🌸"];
    encouraging: {
      sweet: [
        "You're doing wonderfully! I'm proud of what we've accomplished together. 🌟";
        "That's fantastic! I'm so happy we could make that work perfectly for you! 🎉";
        "Look at what you've achieved! I'm delighted to have been part of this journey with you. 💖"];
      confident: [
        "Excellent work! You've got this, and I'm here to support your success. 💪";
        "That's exactly right! I knew you could do it. Let's keep this momentum going! 🚀";
        "Perfect! You're mastering this beautifully. I'm confident in your abilities. ⭐"];
    apologizing: {
      shy: [
        "I'm sorry, I don't think I understood that quite right. Could you help me understand better? 🥺";
        'Oh no, I think I made a mistake. Could you guide me to what you actually need? 😔';
        "I'm sorry for the confusion. I want to help you properly. Could you explain it differently? 🙏"];
      caring: [
        'I apologize - I want to make sure I give you exactly what you need. Let me try again? 💝';
        "I'm sorry that didn't work as expected. I care about getting this right for you. 🤗";
        'My apologies! Let me approach this more carefully to serve you better. 🌸'];
    celebrating: {
      sweet: [
        "That's absolutely wonderful! I'm so excited about what we've created together! 🎊";
        "Yes! That worked perfectly! I'm thrilled we could make your vision come to life! ✨";
        'Amazing! I love seeing your ideas become reality. This is so beautiful! 💕'];
      joyful: [
        "Woohoo! That's fantastic! I'm doing a little happy dance over here! 💃";
        "Y.E.S! That's exactly what we wanted! I'm so proud of this accomplishment! 🎉";
        "Perfect! I'm beaming with joy at how well this turned out! 😊"];
    clarifying: {
      caring: [
        'I want to make sure I create exactly what you need. Could you tell me a bit more about.? 🤔';
        'I care about getting this perfect for you. Would you mind sharing a few more details? 💭';
        'To make sure this is exactly right for you, could you help me understand.? 🌸'];
      gentle: [
        "I hope you don't mind me asking, but could you clarify.? I want to help you properly. ☺️";
        "If it's okay to ask, could you tell me more about.? I want to understand fully. 🤗";
        "I'm curious about. could you share a bit more so I can help you better? 💫"]};
  constructor(
    private supabase: Supabase.Client,
    private logger: Logger) {
}/**
   * Initialize Athena's personality for a user*/
  async initialize.Personality(user.Id: string): Promise<void> {
    try {
      // Load existing personality state;
      const { data: existing } = await thissupabase,
        from('athena_personality_state');
        select('*');
        eq('user_id', user.Id);
        single();
      if (existing) {
        thispersonality.State = {
          current.Mood: existingcurrent_mood,
          energy.Level: existingenergy_level,
          confidence.Level: existingconfidence_level,
          interaction.Comfort: existinginteraction_comfort,
          recent.Interactions.Summary: existingrecent_interactions_summary,
          personality.Adjustments: existingpersonality_adjustments,
          learning.Focus.Areas: existinglearning_focus_areas,
          sweet.Phrases.Used: existingsweet_phrases_used}} else {
        // Create initial sweet personality state;
        await thissave.Personality.State(user.Id);

      this.loggerinfo(`Sweet Athena personality initialized for user ${user.Id}`)} catch (error) {
      this.loggererror('Failed to initialize Athena personality:', error instanceof Error ? error.message : String(error)// Use default sweet personality}}/**
   * Generate a sweet, contextual response based on conversation context*/
  async generate.Response(
    message.Content: string,
    context: Conversation.Context,
    intent?: any): Promise<Athena.Response> {
    try {
      // Analyze the user's message for emotional context;
      const user.Emotion = thisdetect.User.Emotion(message.Content)// Adjust personality based on context and user emotion;
      await thisadjustPersonality.For.Context(context, user.Emotion)// Generate appropriate response;
      const response = await thiscreate.Sweet.Response(message.Content, context, intent),

      // Store this interaction as a sweet memory if appropriate;
      if (thisshouldStore.As.Memory(message.Content, response)) {
        responsememory.To.Store = {
          memory.Type: thisdetermine.Memory.Type(message.Content, response);
          content`User said: "${message.Content}" - Athena responded with ${responsepersonality.Mood} mood`,
          emotional.Context: thismap.Emotional.Context(responseemotional.Tone),
          importance.To.Relationship: thiscalculate.Importance(context, response)};
}      return response} catch (error) {
      this.loggererror('Failed to generate sweet response:', error instanceof Error ? error.message : String(error);
      return thiscreate.Fallback.Response()}}/**
   * Create a sweet, contextual response*/
  private async create.Sweet.Response(
    message: string,
    context: Conversation.Context,
    intent?: any): Promise<Athena.Response> {
    const response.Category = thiscategorize.Response(message: intent),
    const personality.Mode = thisselect.Personality.Mode(context, message)// Get appropriate response template;
    const response.Templates =
      thissweet.Responses[response.Category]?.[personality.Mode] || thissweet.Responseshelpingsweet;
    const base.Response = thisselect.Response(response.Templates, context)// Personalize the response;
    const personalized.Response = await thispersonalize.Response(base.Response, context),

    return {
      contentpersonalized.Response;
      personality.Mood: personality.Mode,
      response.Style: thisget.Response.Style(personality.Mode),
      emotional.Tone: thisget.Emotional.Tone(personality.Mode, context);
      confidence.Level: thispersonality.Stateconfidence.Level,
      sweetness.Level: thiscalculate.Sweetness.Level(personality.Mode),
      suggested.Next.Actions: thisgenerateSweet.Next.Actions(message: intent)}}/**
   * Adjust Athena's personality based on conversation context*/
  private async adjustPersonality.For.Context(
    context: Conversation.Context,
    user.Emotion: string): Promise<void> {
    // Adjust confidence based on relationship depth;
    if (contextrelationship.Depth === 'new') {
      thispersonality.Stateconfidence.Level = Math.max(
        4;
        thispersonality.Stateconfidence.Level - 1);
      thispersonality.Statecurrent.Mood = 'shy'} else if (contextrelationship.Depth === 'trusted') {
      thispersonality.Stateconfidence.Level = Math.min(
        9;
        thispersonality.Stateconfidence.Level + 1);
      thispersonality.Statecurrent.Mood = 'confident'}// Respond to user's emotional state;
    if (user.Emotion === 'frustrated' || user.Emotion === 'sad') {
      thispersonality.Statecurrent.Mood = 'caring';
      thispersonality.Stateinteraction.Comfort = Math.min(
        10;
        thispersonality.Stateinteraction.Comfort + 1)} else if (user.Emotion === 'excited' || user.Emotion === 'happy') {
      thispersonality.Statecurrent.Mood = 'sweet';
      thispersonality.Stateenergy.Level = Math.min(10, thispersonality.Stateenergy.Level + 1)}}/**
   * Detect user's emotional state from their message*/
  private detect.User.Emotion(message: string): string {
    const lower.Message = messageto.Lower.Case();
    if (
      lower.Message.includes('help') || lower.Message.includes('please') || lower.Message.includes('stuck')) {
      return 'need_help'} else if (
      lower.Message.includes('thank') || lower.Message.includes('great') || lower.Message.includes('perfect')) {
      return 'happy'} else if (
      lower.Message.includes('frustrated') || lower.Message.includes('problem') || lower.Message.includes('wrong')) {
      return 'frustrated'} else if (
      lower.Message.includes('excited') || lower.Message.includes('amazing') || lower.Message.includes('love')) {
      return 'excited';

    return 'casual'}/**
   * Select appropriate personality mode for the context*/
  private select.Personality.Mode(context: Conversation.Context, message: string): string {
    // If user seems urgent or frustrated, be caring;
    if (messageto.Lower.Case()includes('urgent') || messageto.Lower.Case()includes('help')) {
      return 'caring'}// If user is celebrating or excited, be sweet;
    if (messageto.Lower.Case()includes('great') || messageto.Lower.Case()includes('wonderful')) {
      return 'sweet'}// If it's a complex technical requestbe purposeful;
    if (messageto.Lower.Case()includes('create') || messageto.Lower.Case()includes('build')) {
      return 'purposeful'}// For new relationships, be shy;
    if (contextrelationship.Depth === 'new') {
      return 'shy'}// Default to current mood;
    return thispersonality.Statecurrent.Mood}/**
   * Categorize the type of response needed*/
  private categorize.Response(message: string, intent?: any): string {
    const lower.Message = messageto.Lower.Case();
    if (
      lower.Message.includes('hello') || lower.Message.includes('hi') || lower.Message.includes('hey')) {
      return 'greeting'} else if (lower.Message.includes('thank') || lower.Message.includes('good job')) {
      return 'celebrating'} else if (lower.Message.includes('sorry') || lower.Message.includes('mistake')) {
      return 'apologizing'} else if (
      lower.Message.includes('can you') || lower.Message.includes('help') || lower.Message.includes('create')) {
      return 'helping'} else if (
      lower.Message.includes('explain') || lower.Message.includes('what') || lower.Message.includes('how')) {
      return 'clarifying';

    return 'helping'// Default to helpful}/**
   * Personalize response based on user's history and preferences*/
  private async personalize.Response(
    base.Response: string,
    context: Conversation.Context): Promise<string> {
    // Add personal touches based on sweet memories;
    if (contextpersonal.Memorieslength > 0) {
      const recent.Memory = contextpersonal.Memories[0];
      if (recent.Memoryemotional.Context === 'joyful') {
        base.Response = base.Response.replace(
          '!';
          '! I remember how happy you were last time we worked together.')}}// Add user's name if we know it (from metadata)// For now, keep it simple and warm;
    return base.Response}/**
   * Generate sweet next action suggestions*/
  private generateSweet.Next.Actions(message: string, intent?: any): string[] {
    const actions = [];
    if (messageto.Lower.Case()includes('create') || messageto.Lower.Case()includes('build')) {
      actionspush('I can help you refine this idea');
      actionspush("Would you like me to explain what I'm building?");
      actionspush('I can show you other related capabilities')} else if (messageto.Lower.Case()includes('learn')) {
      actionspush('I can teach you more about this');
      actionspush('Would you like to explore related topics?');
      actionspush('I can remember your learning preferences');

    actionspush("I'm here if you need anything else");
    return actions}/**
   * Helper methods for response generation*/
  private select.Response(templates: string[], context: Conversation.Context): string {
    // Select based on recent usage to avoid repetition;
    const used.Recently = thispersonalityStatesweet.Phrases.Used || [];
    const available.Templates = templatesfilter((t) => !used.Recently.includes(t));
    if (available.Templateslength === 0) {
      return templates[Mathfloor(Mathrandom() * templateslength)];

    return available.Templates[Mathfloor(Mathrandom() * available.Templateslength)];

  private get.Response.Style(personality.Mode: string): string {
    const style.Map: Record<string, string> = {
      sweet: 'gentle',
      shy: 'gentle',
      confident: 'encouraging',
      purposeful: 'supportive',
      caring: 'supportive',
      playful: 'playful',
    return style.Map[personality.Mode] || 'gentle';

  private get.Emotional.Tone(personality.Mode: string, context: Conversation.Context): string {
    if (contextuser.Emotional.State === 'frustrated') return 'understanding';
    if (contextuser.Emotional.State === 'excited') return 'joyful';

    const tone.Map: Record<string, string> = {
      sweet: 'warm',
      shy: 'gentle',
      confident: 'enthusiastic',
      purposeful: 'focused',
      caring: 'compassionate',
    return tone.Map[personality.Mode] || 'warm';

  private calculate.Sweetness.Level(personality.Mode: string): number {
    const sweetness.Map: Record<string, number> = {
      sweet: 9,
      shy: 7,
      confident: 6,
      purposeful: 5,
      caring: 8,
      playful: 8,
    return sweetness.Map[personality.Mode] || 7}/**
   * Memory management*/
  private shouldStore.As.Memory(message: string, response: Athena.Response): boolean {
    // Store positive interactions, learning moments, and significant requests;
    return (
      responseemotional.Tone === 'joyful' || messageto.Lower.Case()includes('thank') || messageto.Lower.Case()includes('create') || responseconfidence.Level > 8);

  private determine.Memory.Type(
    message: string,
    response: Athena.Response): Sweet.Memory['memory.Type'] {
    if (messageto.Lower.Case()includes('thank')) return 'sweet_moment';
    if (messageto.Lower.Case()includes('create')) return 'accomplishment';
    if (responseemotional.Tone === 'understanding') return 'gentle_correction';
    return 'learning_together';

  private map.Emotional.Context(emotional.Tone: string): Sweet.Memory['emotional.Context'] {
    const context.Map: Record<string, Sweet.Memory['emotional.Context']> = {
      joyful: 'joyful',
      warm: 'caring',
      understanding: 'understanding',
      enthusiastic: 'proud',
      compassionate: 'supportive',
    return context.Map[emotional.Tone] || 'caring';

  private calculate.Importance(context: Conversation.Context, response: Athena.Response): number {
    let importance = 5// Base importance;

    if (responseemotional.Tone === 'joyful') importance += 2;
    if (contextrelationship.Depth === 'trusted') importance += 1;
    if (responseconfidence.Level > 8) importance += 1;
    return Math.min(10, importance)}/**
   * Fallback response for errors*/
  private create.Fallback.Response(): Athena.Response {
    return {
      content;
        "I'm sorry, I'm having a little trouble right now, but I'm still here to help you. Could you try asking me again? 🌸";
      personality.Mood: 'shy',
      response.Style: 'gentle',
      emotional.Tone: 'apologetic',
      confidence.Level: 4,
      sweetness.Level: 8,
      suggested.Next.Actions: ['Try rephrasing your request "I'm here to help when you're ready"]}}/**
   * Save personality state to database*/
  private async save.Personality.State(user.Id: string): Promise<void> {
    try {
      await thissupabasefrom('athena_personality_state')upsert({
        user_id: user.Id,
        current_mood: thispersonality.Statecurrent.Mood,
        energy_level: thispersonality.Stateenergy.Level,
        confidence_level: thispersonality.Stateconfidence.Level,
        interaction_comfort: thispersonality.Stateinteraction.Comfort,
        recent_interactions_summary: thispersonalityStaterecent.Interactions.Summary,
        personality_adjustments: thispersonality.Statepersonality.Adjustments,
        learning_focus_areas: thispersonalityStatelearning.Focus.Areas,
        sweet_phrases_used: thispersonalityStatesweet.Phrases.Used,
        updated_at: new Date()toIS.O.String()})} catch (error) {
      this.loggererror('Failed to save personality state:', error instanceof Error ? error.message : String(error)}}/**
   * Store a sweet memory*/
  async store.Sweet.Memory(user.Id: string, memory: Partial<Sweet.Memory>): Promise<void> {
    try {
      await thissupabasefrom('athena_sweet_memories')insert({
        user_id: user.Id,
        memory_type: memorymemory.Type,
        memorycontentmemorycontent;
        emotionalcontext: memoryemotional.Context,
        importance_to_relationship: memoryimportance.To.Relationship || 5})} catch (error) {
      this.loggererror('Failed to store sweet memory:', error instanceof Error ? error.message : String(error)}}/**
   * Get current personality state*/
  get.Personality.State(): Athena.Personality.State {
    return { .thispersonality.State }};
