/**
 * Helper types and utilities for code executed via pageevaluate()* These helpers ensure proper typing for browser context execution*/

/**
 * Type for functions that will be executed in the browser context via pageevaluate()* This makes it clear that window, document, and other browser A.P.Is are available*/
export type Browser.Evaluate.Function<T = any> = () => T | Promise<T>
/**
 * Helper to create properly typed browser evaluate functions* @param fn Function to be executed in browser context* @returns The same function with proper typing*/
export function browser.Evaluate<T>(fn: Browser.Evaluate.Function<T>): Browser.Evaluate.Function<T> {
  return fn}/**
 * Common browser context utilities available in pageevaluate()*/
export interface Browser.Context.Utils {
  clear.Storage(): void;
  get.Errors(): any[];
  get.Console.Messages(): any[];
  get.Page.Info(): {
    title: string,
    url: string,
    errors: any[],
    console: any[],
  }}/**
 * Standard browser context utilities implementation* These can be injected into pageevaluate() calls*/
export const browser.Context.Utils: Browser.Context.Utils = {
  clear.Storage: () => {
    windowlocal.Storageclear();
    windowsession.Storageclear();
}  get.Errors: () => {
    return (window as any)errors || [];
  get.Console.Messages: () => {
    return (window as any)console || [];
  get.Page.Info: () => {
    return {
      title: documenttitle,
      url: windowlocationhref,
      errors: (window as any)errors || [],
      console: (window as any)console || [],
    }};