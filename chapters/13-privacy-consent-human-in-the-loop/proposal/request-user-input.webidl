[Exposed=Window, SecureContext]
interface ModelContextClient {
  Promise<ModelContextUserInputResult> requestUserInput(
      ModelContextUserInputOptions options,
      optional ModelContextInteractiveCallback callback);
};

callback ModelContextInteractiveCallback = Promise<any> ();

enum ModelContextUserInputMode { "interactive", "form", "url" };

enum ModelContextUserInputAction { "accept", "decline", "cancel" };

dictionary ModelContextUserInputOptions {
  required ModelContextUserInputMode mode;
  USVString message;
  object requestedSchema;
  USVString url;
  AbortSignal signal;
};

dictionary ModelContextUserInputResult {
  required ModelContextUserInputAction action;
  object content;
};
