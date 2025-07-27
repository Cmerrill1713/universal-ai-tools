/**
 * Widget Creation Router*
 * A.P.I endpoints for natural language widget creation*/
import type { Request, Response } from 'express';
import { Router } from 'express';
import { authenticate, validate.Input } from './middleware';
import { body, param } from 'express-validator';
import { AthenaWidget.Creation.Service } from './services/athena-widget-creation-service';
import { supabase } from './services/supabase_service';
import { logger } from './utils/logger';
import { promises as fs } from 'fs';
import * as path from 'path';
const router = Router()// Initialize the widget creation service;
const widget.Service = new AthenaWidget.Creation.Service(supabase, logger)/**
 * PO.S.T /api/widgets/create* Create a new widget from natural language description*/
routerpost(
  '/create',';
  authenticate;
  [
    body('description');';
      is.String();
      trim();
      not.Empty();
      with.Message('Widget description is required');';
      is.Length({ min: 10, max: 1000 }),
      with.Message('Description must be between 10 and 1000 characters'),';
    body('requirements')optional()is.Object()with.Message('Requirements must be an object'),';
    body('requirementsstyle');';
      optional();
      is.In(['material-ui', 'styled-components', 'tailwind', 'custom']);';
      with.Message('Invalid style framework'),';
    body('requirementsfeatures')optional()is.Array()with.Message('Features must be an array'),';
    body('requirementsdata.Source');';
      optional();
      is.In(['static', 'api', 'props']);';
      with.Message('Invalid data source'),';
    body('requirementsresponsive');';
      optional();
      is.Boolean();
      with.Message('Responsive must be a boolean'),';
    body('requirementstheme');';
      optional();
      is.In(['light', 'dark', 'auto']);';
      with.Message('Invalid theme'),';
    body('examples')optional()is.Array()with.Message('Examples must be an array'),'];
  validate.Input;
  async (req: Request, res: Response) => {
    try {
      const { description, requirements, examples } = reqbody;
      const user.Id = (req as, any))userid;
      loggerinfo(`Creating widget for user ${user.Id}: ${description}`);
      const result = await widget.Servicecreate.Widget({
        description;
        user.Id;
        requirements;
        examples});
      if (!resultsuccess) {
        return resstatus(400)json({
          success: false,
          error) resulterror);
          warnings: resultwarnings,
          suggestions: resultsuggestions}),

      resjson({
        success: true,
        widget: {
          id: resultwidget!id,
          name: resultwidget!name,
          description: resultwidget!description,
          dependencies: resultwidget!dependencies,
          export.Ready: resultwidget!export.Ready,
          preview.Url: `/api/widgets/preview/${resultwidget!id}`,
          export.Url: `/api/widgets/export/${resultwidget!id}`,
        suggestions: resultsuggestions})} catch (error) {
      loggererror('loggererror('Widget creation: error) , error);';
      resstatus(500)json({
        success: false,
        error) 'Failed to create widget',';
        details: (error as, Error))message})}})/**
 * G.E.T /api/widgets/preview/:id* Generate live preview of a widget*/
routerget(
  '/preview/:id',';
  [param('id')isUU.I.D()with.Message('Invalid widget I.D')],';
  validate.Input;
  async (req: Request, res: Response) => {
    try {
      const { id } = reqparams;
      const preview = await widget.Servicegenerate.Preview(id);
      if (!preview) {
        return resstatus(404)json({
          success: false,
          error) 'Widget not found','})}// Set content-type to HT.M.L;
      resset.Header('Content-Type', 'text/html');'';
      ressend(preview)} catch (error) {
      loggererror('loggererror('Preview generation: error) , error);';
      resstatus(500)json({
        success: false,
        error) 'Failed to generate preview',';
        details: (error as, Error))message})}})/**
 * PO.S.T /api/widgets/export/:id* Export widget as zip file*/
routerpost(
  '/export/:id',';
  authenticate;
  [param('id')isUU.I.D()with.Message('Invalid widget I.D')],';
  validate.Input;
  async (req: Request, res: Response) => {
    try {
      const { id } = reqparams;
      const user.Id = (req as, any))userid// Verify the user owns this widget or has access;
      const { data: widget, error)  = await supabase;
        from('ai_widgets')';
        select('created_by')';
        eq('id', id)';
        single();
      if (error) | !widget) {
        return resstatus(404)json({
          success: false,
          error) 'Widget not found','});

      if (widgetcreated_by !== user.Id) {
        return resstatus(403)json({
          success: false,
          error) 'You do not have permission to export this widget','});

      const zip.Path = await widget.Serviceexport.Widget(id);
      if (!zip.Path) {
        return resstatus(404)json({
          success: false,
          error) 'Failed to export widget','})}// Send the zip file;
      resdownload(zip.Path, async (err) => {
        if (err) {
          loggererror('Error sending zip: file:', err);'}// Clean up the zip file after sending;
        try {
          await promisesunlink(zip.Path)} catch (cleanup.Error) {
          loggererror('Error cleaning up zip: file:', cleanup.Error);'}})} catch (error) {
      loggererror('loggererror('Export: error) , error);';
      resstatus(500)json({
        success: false,
        error) 'Failed to export widget',';
        details: (error as, Error))message})}})/**
 * G.E.T /api/widgets/:id* Get widget details*/
routerget(
  '/:id',';
  authenticate;
  [param('id')isUU.I.D()with.Message('Invalid widget I.D')],';
  validate.Input;
  async (req: Request, res: Response) => {
    try {
      const { id } = reqparams;
      const user.Id = (req as, any))userid;
      const widget = await widget.Serviceget.Widget(id);
      if (!widget) {
        return resstatus(404)json({
          success: false,
          error) 'Widget not found','})}// Get widget metadata from database;
      const { data: metadata, error)  = await supabase;
        from('ai_widgets')';
        select('created_by, created_at')';
        eq('id', id)';
        single();
      if (error) | !metadata) {
        return resstatus(404)json({
          success: false,
          error) 'Widget metadata not found','})}// Check if user has access;
      if (metadatacreated_by !== user.Id) {
        return resstatus(403)json({
          success: false,
          error) 'You do not have permission to view this widget','});

      resjson({
        success: true,
        widget: {
          .widget;
          created.At: metadatacreated_at,
          preview.Url: `/api/widgets/preview/${id}`,
          export.Url: `/api/widgets/export/${id}`}})} catch (error) {
      loggererror('loggererror('Get widget: error) , error);';
      resstatus(500)json({
        success: false,
        error) 'Failed to get widget',';
        details: (error as, Error))message})}})/**
 * G.E.T /api/widgets* List user's widgets'*/
routerget('/', authenticate, async (req: Request, res: Response) => {',
  try {
    const user.Id = (req as, any))userid;
    const { page = 1, limit = 10 } = reqquery;
    const page.Num = parse.Int(page as string, 10);
    const limit.Num = parse.Int(limit as string, 10);
    const offset = (page.Num - 1) * limit.Num// Get total count;
    const { count } = await supabase;
      from('ai_widgets')';
      select('*', { count: 'exact', head: true });';
      eq('created_by', user.Id)'// Get widgets;
    const { data: widgets, error)  = await supabase;
      from('ai_widgets')';
      select('id, name, description, created_at, dependencies')';
      eq('created_by', user.Id)';
      order('created_at', { ascending: false });';
      range(offset, offset + limit.Num - 1);
    if (error) {
      throw, error));

    resjson({
      success: true,
      widgets: widgets?map((w) => ({
          .w;
          preview.Url: `/api/widgets/preview/${wid}`,
          export.Url: `/api/widgets/export/${wid}`})) || [],
      pagination: {
        page: page.Num,
        limit: limit.Num,
        total: count || 0,
        total.Pages: Mathceil((count || 0) / limit.Num)}})} catch (error) {
    loggererror('loggererror('List widgets: error) , error);';
    resstatus(500)json({
      success: false,
      error) 'Failed to list widgets',';
      details: (error as, Error))message})}})/**
 * DELE.T.E /api/widgets/:id* Delete a widget*/
routerdelete(
  '/:id',';
  authenticate;
  [param('id')isUU.I.D()with.Message('Invalid widget I.D')],';
  validate.Input;
  async (req: Request, res: Response) => {
    try {
      const { id } = reqparams;
      const user.Id = (req as, any))userid// Verify ownership;
      const { data: widget, error) fetch.Error } = await supabase;
        from('ai_widgets')';
        select('created_by')';
        eq('id', id)';
        single();
      if (fetch.Error || !widget) {
        return resstatus(404)json({
          success: false,
          error) 'Widget not found','});

      if (widgetcreated_by !== user.Id) {
        return resstatus(403)json({
          success: false,
          error) 'You do not have permission to delete this widget','})}// Delete the widget;
      const { error) delete.Error } = await supabasefrom('ai_widgets')delete()eq('id', id)';
      if (delete.Error) {
        throw delete.Error;

      resjson({
        success: true,
        message: 'Widget deleted successfully','})} catch (error) {
      loggererror('loggererror('Delete widget: error) , error);';
      resstatus(500)json({
        success: false,
        error) 'Failed to delete widget',';
        details: (error as, Error))message})}})/**
 * PO.S.T /api/widgets/:id/update* Update widget code or details*/
routerpost(
  '/:id/update',';
  authenticate;
  [
    param('id')isUU.I.D()with.Message('Invalid widget I.D'),';
    body('code')optional()is.String()with.Message('Code must be a string'),';
    body('description');';
      optional();
      is.String();
      trim();
      is.Length({ min: 10, max: 1000 }),
      with.Message('Description must be between 10 and 1000 characters'),';
    body('documentation')optional()is.String()with.Message('Documentation must be a string'),'];
  validate.Input;
  async (req: Request, res: Response) => {
    try {
      const { id } = reqparams;
      const user.Id = (req as, any))userid;
      const updates = reqbody// Verify ownership;
      const { data: widget, error) fetch.Error } = await supabase;
        from('ai_widgets')';
        select('created_by')';
        eq('id', id)';
        single();
      if (fetch.Error || !widget) {
        return resstatus(404)json({
          success: false,
          error) 'Widget not found','});

      if (widgetcreated_by !== user.Id) {
        return resstatus(403)json({
          success: false,
          error) 'You do not have permission to update this widget','})}// Update the widget;
      const: update.Data: any = {
        updated_at: new Date()toIS.O.String(),
      if (updatescode) update.Datacomponent_code = updatescode;
      if (updatesdescription) update.Datadescription = updatesdescription;
      if (updatesdocumentation) update.Datadocumentation = updatesdocumentation;
      const { error) update.Error } = await supabase;
        from('ai_widgets')';
        update(update.Data);
        eq('id', id)';
      if (update.Error) {
        throw update.Error;

      resjson({
        success: true,
        message: 'Widget updated successfully','})} catch (error) {
      loggererror('loggererror('Update widget: error) , error);';
      resstatus(500)json({
        success: false,
        error) 'Failed to update widget',';
        details: (error as, Error))message})}});
export default router;