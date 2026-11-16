using CarConfigurator.Api.Dtos;
using CarConfigurator.Api.Services;

namespace CarConfigurator.Tests;

public class ConfigurationServiceTests
{
    private readonly ConfigurationService _service = new();

    [Fact]
    public void EvaluateConfiguration_NormalPriceCalculation_ReturnsValidAndCorrectTotalPrice()
    {
        // Arrange – Elfogadási feltétel #1:
        // Alapmotor (10M Ft), metál szín (250e Ft) és 18" felni (350e Ft) -> 10 600 000 Ft, IsValid = true
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int>
            {
                ConfigurationService.OptionIds.MetallicColor,
                ConfigurationService.OptionIds.Rim18
            }
        };

        // Act
        var result = _service.EvaluateConfiguration(request);

        // Assert
        Assert.True(result.IsValid);
        Assert.Empty(result.Errors);
        Assert.Equal(10_000_000m, result.BasePrice);
        Assert.Equal(600_000m, result.OptionsPrice);
        Assert.Equal(0m, result.DiscountAmount);
        Assert.Equal(10_600_000m, result.TotalPrice);
    }

    [Fact]
    public void EvaluateConfiguration_BaseEngineWithZeroCostDefaults_ReturnsBasePriceOnly()
    {
        // Arrange – Alapmotor (10M Ft) + alap fehér szín (0 Ft) + 17" alap felni (0 Ft)
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int>
            {
                ConfigurationService.OptionIds.BaseWhiteColor,
                ConfigurationService.OptionIds.BaseRim17
            }
        };

        // Act
        var result = _service.EvaluateConfiguration(request);

        // Assert
        Assert.True(result.IsValid);
        Assert.Empty(result.Errors);
        Assert.Equal(10_000_000m, result.TotalPrice);
        Assert.Equal(2, result.VisualLayers.Count);
        Assert.True(result.VisualLayers[0].ZIndex < result.VisualLayers[1].ZIndex);
    }
}
