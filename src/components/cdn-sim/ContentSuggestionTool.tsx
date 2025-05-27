
"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, Loader2, AlertTriangle } from 'lucide-react';
import { suggestAlternativeContent, SuggestAlternativeContentInput, SuggestAlternativeContentOutput } from '@/ai/flows/suggest-alternative-content';
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  initialRequest: z.string().min(10, { message: "Please describe your content idea in at least 10 characters." }),
});
type FormData = z.infer<typeof formSchema>;

export function ContentSuggestionTool() {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestAlternativeContentOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setIsLoading(true);
    setError(null);
    setSuggestions(null);
    try {
      const result = await suggestAlternativeContent({ initialRequest: data.initialRequest });
      setSuggestions(result);
    } catch (err) {
      console.error("Error fetching content suggestions:", err);
      setError("Failed to get suggestions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (content: string) => {
    setValue("initialRequest", content);
    toast({
      title: "Suggestion Copied",
      description: "The content idea has been copied to the textarea.",
      duration: 3000,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="shadow hover:shadow-md transition-shadow">
          <Lightbulb className="mr-2 h-4 w-4" />
          Get Content Suggestions
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] bg-card text-card-foreground rounded-lg shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Content Caching Advisor</DialogTitle>
          <DialogDescription>
            Enter your video content idea, and our AI will suggest alternatives that are easily cacheable on a CDN. Click a suggestion to edit it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="initialRequest" className="text-sm font-medium">Your Content Idea</Label>
            <Textarea
              id="initialRequest"
              placeholder="e.g., Live stream of a sports game, personalized video messages"
              {...register("initialRequest")}
              className="min-h-[100px] bg-background border-input rounded-md shadow-sm focus:ring-primary"
            />
            {errors.initialRequest && <p className="text-sm text-destructive">{errors.initialRequest.message}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading} className="w-full sm:w-auto shadow hover:shadow-md transition-shadow">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Getting Suggestions...
                </>
              ) : (
                "Suggest Alternatives"
              )}
            </Button>
          </DialogFooter>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive text-destructive rounded-md flex items-center gap-2">
            <AlertTriangle size={18} />
            <p>{error}</p>
          </div>
        )}

        {suggestions && suggestions.suggestions.length > 0 && (
          <div className="mt-6 space-y-4 max-h-[300px] overflow-y-auto pr-2">
            <h3 className="text-lg font-semibold text-foreground">AI Suggestions:</h3>
            {suggestions.suggestions.map((suggestion, index) => (
              <Card 
                key={index} 
                className="bg-background/50 border-border rounded-md shadow cursor-pointer hover:bg-accent/20 transition-colors"
                onClick={() => handleSuggestionClick(suggestion.content)}
                tabIndex={0} // Make it focusable
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSuggestionClick(suggestion.content);}} // Make it keyboard accessible
              >
                <CardHeader className="p-4">
                  <CardTitle className="text-md text-primary">{suggestion.content}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
