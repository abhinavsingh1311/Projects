﻿// <auto-generated> This file has been auto generated by EF Core Power Tools. </auto-generated>
#nullable disable
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace SalesReturnSystem.Entities;

[Table("SaleRefundDetail")]
[Index("SaleRefundId", "PartId", Name = "UQ_SaleRefundDetail_SaleRefundIDPartID", IsUnique = true)]
internal partial class SaleRefundDetail
{
    [Key]
    [Column("SaleRefundDetailID")]
    public int SaleRefundDetailId { get; set; }

    [Column("SaleRefundID")]
    public int SaleRefundId { get; set; }

    [Column("PartID")]
    public int PartId { get; set; }

    public int Quantity { get; set; }

    [Column(TypeName = "money")]
    public decimal SellingPrice { get; set; }

    [StringLength(150)]
    public string Reason { get; set; }

    public bool RemoveFromViewFlag { get; set; }

    [ForeignKey("PartId")]
    [InverseProperty("SaleRefundDetails")]
    public virtual Part Part { get; set; }

    [ForeignKey("SaleRefundId")]
    [InverseProperty("SaleRefundDetails")]
    public virtual SaleRefund SaleRefund { get; set; }
}