using Azure.Monitor.OpenTelemetry.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Send logs, requests, dependencies and exceptions to Application Insights.
// Only enable it when a connection string is set, so local runs work without Azure.
if (!string.IsNullOrWhiteSpace(builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"]))
{
    builder.Services.AddOpenTelemetry().UseAzureMonitor();
}

builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() ?? [];
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

// Must come before UseCors: the handler re-runs the pipeline, so the 500 response also gets CORS headers.
app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();
app.UseHttpsRedirection();

app.MapGet("/api/status", (ILogger<Program> logger) =>
{
    logger.LogInformation("Status check succeeded on {Server}", Environment.MachineName);
    return new StatusResponse(
        "Connected! The .NET API says hello.",
        Environment.MachineName,
        DateTimeOffset.UtcNow);
})
.WithName("GetStatus");

// Endpoints that simulate failures. The self-healing project uses them to create
// known errors in Application Insights.
var simulate = app.MapGroup("/api/simulate");

simulate.MapGet("/bad-request", (ILogger<Program> logger) =>
{
    logger.LogWarning("Simulated bad request: the 'orderId' parameter is missing");
    return Results.Problem(
        title: "Validation failed",
        detail: "Simulated error: the 'orderId' parameter is missing.",
        statusCode: StatusCodes.Status400BadRequest);
})
.WithName("SimulateBadRequest");

simulate.MapGet("/not-found", (ILogger<Program> logger) =>
{
    logger.LogWarning("Simulated not found: order {OrderId} does not exist", 42);
    return Results.Problem(
        title: "Not found",
        detail: "Simulated error: order 42 does not exist.",
        statusCode: StatusCodes.Status404NotFound);
})
.WithName("SimulateNotFound");

simulate.MapGet("/server-error", (ILogger<Program> logger) =>
{
    logger.LogError("Simulated server error is about to be thrown");
    throw new InvalidOperationException("Simulated unhandled exception in /api/simulate/server-error.");
})
.WithName("SimulateServerError");

simulate.MapGet("/slow", async (ILogger<Program> logger, int? delayMs, CancellationToken cancellationToken) =>
{
    var delay = Math.Clamp(delayMs ?? 5000, 0, 30000);
    logger.LogWarning("Simulated slow request: waiting {DelayMs} ms", delay);
    await Task.Delay(delay, cancellationToken);
    return new StatusResponse(
        $"Slow response after {delay} ms.",
        Environment.MachineName,
        DateTimeOffset.UtcNow);
})
.WithName("SimulateSlow");

app.Run();

record StatusResponse(string Message, string Server, DateTimeOffset TimestampUtc);
