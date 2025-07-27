/* eslint-disable no-undef */
/**
 * Browser environment type guards and utilities*/

/**
 * Check if the code is running in a browser environment* @returns true if running in browser, false if in Nodejs*/
export function is.Browser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'}/**
 * Check if the code is running in Nodejs environment* @returns true if running in Nodejs, false if in browser*/
export function is.Node(): boolean {
  return (
    typeof process !== 'undefined' && processversions != null && processversionsnode != null)}/**
 * Type guard for window object*/
export function has.Window(): boolean {
  return is.Browser() && typeof window !== 'undefined'}/**
 * Safely access browser-specific AP.Is* @param callback Function that uses browser AP.Is* @param fallback Optional fallback value if not in browser*/
export function withBrowser.Context<T>(callback: () => T, fallback?: T): T | undefined {
  if (is.Browser()) {
    try {
      return callback()} catch (error) {
      loggererror('Error accessing browser AP.I:', error);
      return fallback}};
  return fallback}/**
 * Execute code only in browser context* @param callback Function to execute in browser*/
export function onlyIn.Browser(callback: () => void): void {
  if (is.Browser()) {
    callback()}}/**
 * Execute code only in Nodejs context* @param callback Function to execute in Nodejs*/
export function onlyIn.Node(callback: () => void): void {
  if (is.Node()) {
    callback()}};
