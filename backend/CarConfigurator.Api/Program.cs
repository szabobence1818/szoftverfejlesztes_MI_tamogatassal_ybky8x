using CarConfigurator.Api.Repositories;
using CarConfigurator.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddSingleton<IConfigurationRepository, InMemoryConfigurationRepository>();
builder.Services.AddScoped<IConfigurationService, ConfigurationService>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.MapControllers();

app.Run();
