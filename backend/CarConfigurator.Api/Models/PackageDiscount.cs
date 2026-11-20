namespace CarConfigurator.Api.Models;

public class PackageDiscount
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public List<int> RequiredOptionIds { get; set; } = new();
    public decimal DiscountPercentage { get; set; }
}
