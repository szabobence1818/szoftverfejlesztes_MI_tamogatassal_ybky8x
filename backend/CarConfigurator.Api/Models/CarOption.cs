namespace CarConfigurator.Api.Models;

public class CarOption
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public OptionCategory Category { get; set; }
    public decimal Price { get; set; }
    public string? LayerImageUrl { get; set; }
    public int? ZIndex { get; set; }
}
