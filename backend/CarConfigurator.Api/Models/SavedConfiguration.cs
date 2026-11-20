namespace CarConfigurator.Api.Models;

public class SavedConfiguration
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public int EngineOptionId { get; set; }
    public List<int> SelectedOptionIds { get; set; } = new();
    public decimal SavedTotalPrice { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
